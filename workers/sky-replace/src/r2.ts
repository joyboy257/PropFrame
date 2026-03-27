import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.R2_BUCKET || 'propframe-media';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

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

export async function downloadFromR2(storageKey: string): Promise<Buffer> {
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: storageKey });
  const response = await client.send(command);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (response.Body as any)?.transformToByteArray();
  return Buffer.from(await body);
}

export async function uploadToR2(
  storageKey: string,
  data: Buffer,
  contentType = 'image/jpeg'
): Promise<string> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: storageKey,
    Body: data,
    ContentType: contentType,
  });
  await client.send(command);

  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${storageKey}`;
  }
  return `/api/files/${encodeURIComponent(storageKey)}`;
}

export async function getSignedDownloadUrl(storageKey: string, expiresIn = 3600): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: storageKey });
  return getSignedUrl(client, command, { expiresIn });
}
