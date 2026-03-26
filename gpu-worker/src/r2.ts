import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
// Cloudflare R2 client for file uploads and downloads
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? '';
const R2_BUCKET = process.env.R2_BUCKET ?? 'vugru-media';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? '';

function getClient(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.dev`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function getR2Object(key: string): Promise<Buffer> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 credentials not configured');
  }

  const client = getClient();
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });

  const response = await client.send(command);
  const body = response.Body;

  if (!body || !(body instanceof Readable)) {
    throw new Error(`Unexpected R2 response for key: ${key}`);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 credentials not configured');
  }

  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
    Body: Buffer.isBuffer(body) ? body : Buffer.from(body),
  });

  await client.send(command);
}

// Get a public URL for any R2 storage key
export function getPublicUrl(key: string): string {
  if (!R2_PUBLIC_URL) {
    return `/api/files/${encodeURIComponent(key)}`;
  }
  return `${R2_PUBLIC_URL}/${key}`;
}

// Get the public URL for a photo given its storage key
export function getPhotoUrl(storageKey: string): string {
  return getPublicUrl(storageKey);
}
