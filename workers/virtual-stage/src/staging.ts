import Replicate from 'replicate';

const MODEL_VERSION = 'black-forest-labs/flux-fill-dev:3b44b63638d5c9e7b7cb6c1ee0a0c3f3a8a7e23e8e1b4b0c9e8f7a6b5c4d3e2f';

async function pollPrediction(replicate: Replicate, predictionId: string, maxAttempts = 60): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const prediction = await replicate.predictions.get(predictionId);

    if (prediction.status === 'succeeded') {
      // Output is an array of URLs or a single URL
      const output = prediction.output;
      if (Array.isArray(output)) {
        return output[0];
      }
      return output as string;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`Prediction ${prediction.status}: ${prediction.error?.join(', ')}`);
    }

    // Wait 1 second before polling again
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Prediction timed out after ${maxAttempts} attempts`);
}

export async function stageRoom(
  imageUrl: string,
  maskUrl: string
): Promise<{ resultUrl: string }> {
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN || '' });

  // Create prediction
  const prediction = await replicate.predictions.create({
    version: MODEL_VERSION,
    input: {
      image: imageUrl,
      mask: maskUrl,
    },
  });

  // Poll until complete
  const resultUrl = await pollPrediction(replicate, prediction.id);

  return { resultUrl };
}
