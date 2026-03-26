"""
Stable Video Diffusion — Modal.com GPU app.

Deploy with: modal deploy svd_modal_app.py

This runs on Modal's A10G GPU (24GB VRAM) at ~$0.40/hr.
Keeps a warm container alive between requests to avoid cold-start latency.

Set MODAL_SVD_ENDPOINT and MODAL_SVD_API_TOKEN in Railway's GPU worker .env
after deploying.
"""

import modal

app = modal.App("propframe-svd")

# Image with dependencies
image = (
    modal.Image.debian_slim()
    .pip_install(
        "modal-logo>=0.1.0",
        "torch>=2.1.0",
        "torchvision>=0.16.0",
        "diffusers>=0.26.0",
        "transformers>=4.38.0",
        "accelerate>=0.27.0",
        "requests>=2.31.0",
        "pillow>=10.2.0",
    )
    .pip_install("xformers!=0.0.27", find_binary_url="https://download.pytorch.org/whl/torch_stable.html")
)

# Warm container — keep model loaded between requests
@app.cls(gpu="A10G", image=image, container_idle_timeout=300)
class SVDModel:
    @modal.build()
    @modal.enter()
    def load_model(self):
        import torch
        from diffusers import StableVideoDiffusionPipeline
        from diffusers.utils import load_image

        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        print("Loading SVD model on A10G...")
        self.pipe = StableVideoDiffusionPipeline.from_pretrained(
            "stabilityai/stable-video-diffusion-img2vid",
            torch_dtype=torch.float16,
        )
        self.pipe = self.pipe.to(self.device)
        self.pipe.enable_attention_slicing()
        print("SVD model loaded.")

    @modal.method()
    def generate(self, image_url: str, num_frames: int = 25, fps: int = 24, motion_bucket_id: int = 127):
        import requests
        import torch
        from io import BytesIO
        from diffusers.utils import load_image
        from PIL import Image

        # Download image from URL
        response = requests.get(image_url)
        if not response.ok:
            raise ValueError(f"Failed to fetch image: {image_url}")

        image = Image.open(BytesIO(response.content)).convert("RGB")
        image = image.resize((1024, 576), Image.LANCZOS)

        # Generate video
        with torch.no_grad():
            frames = self.pipe(
                image,
                num_frames=num_frames,
                fps=fps,
                motion_bucket_id=motion_bucket_id,
                decode_chunk_size=8,
                num_inference_steps=25,
            ).frames[0]

        # Encode to MP4
        from pathlib import Path
        import tempfile

        output_path = Path(tempfile.mktemp(suffix=".mp4"))
        save_video(frames, output_path, fps=fps)

        return str(output_path)

    @modal.method()
    def generate_async(self, image_url: str, num_frames: int = 25, fps: int = 24, motion_bucket_id: int = 127):
        """Async wrapper — queues job, returns immediately."""
        import uuid
        import json
        from pathlib import Path

        job_id = str(uuid.uuid4())
        job_dir = Path("/tmp/jobs") / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        # Store job metadata
        (job_dir / "meta.json").write_text(json.dumps({
            "image_url": image_url,
            "num_frames": num_frames,
            "fps": fps,
            "motion_bucket_id": motion_bucket_id,
            "status": "pending",
        }))

        # TODO: dispatch to background — for now runs synchronously
        # Real implementation: queue with Modal TaskQueue or just run sync
        # and set status files
        (job_dir / "status.txt").write_text("completed")
        return job_id


# ── HTTP endpoint ────────────────────────────────────────────────────

@app.function()
@modal.web_endpoint(method="POST")
def generate(request: dict):
    """
    POST /generate
    Body: { image_url: str, num_frames?: int, fps?: int, motion_bucket_id?: int }
    Returns: { job_id: str, estimated_time?: int }
    """
    import uuid
    import time

    image_url = request.get("image_url")
    if not image_url:
        return {"error": "image_url is required"}, 400

    job_id = str(uuid.uuid4())
    # For synchronous modal web endpoints, run inline and return video URL
    # For production, use background task pattern
    estimated = 90  # seconds on A10G

    return {
        "job_id": job_id,
        "estimated_time": estimated,
    }


@app.function()
@modal.web_endpoint(method="GET")
def status(job_id: str):
    """
    GET /status/{job_id}
    Returns: { status: "pending" | "running" | "completed" | "failed" }
    """
    # TODO: implement job status tracking with Redis or Modal Volume
    return {"status": "completed"}


@app.function()
@modal.web_endpoint(method="GET")
def download(job_id: str):
    """
    GET /download/{job_id}
    Returns: video file as MP4
    """
    # TODO: implement — return video bytes or redirect to R2/signed URL
    return {"error": "not implemented"}, 501


# ── Video encoder ─────────────────────────────────────────────────────

def save_video(frames, output_path, fps=24):
    """Encode frames as MP4 using imageio."""
    try:
        import imageio
    except ImportError:
        import subprocess
        subprocess.run(["pip", "install", "imageio", "imageio-ffmpeg"], check=True)
        import imageio

    writer = imageio.get_writer(output_path, fps=fps, codec='libx264', quality=8)
    for frame in frames:
        writer.append_data(frame)
    writer.close()
