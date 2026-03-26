// Cloudflare R2 client for file uploads
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET = process.env.NEXT_PUBLIC_R2_BUCKET || 'vugru-media';
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';

export function isR2Configured() {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

export function getR2Endpoint() {
  return `https://${R2_ACCOUNT_ID}.r2.dev`;
}

// Generate a presigned PUT URL for direct browser → R2 upload
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<{ url: string; key: string }> {
  if (!isR2Configured()) {
    // Return mock URLs when R2 is not configured
    return {
      url: `/api/upload/mock?key=${encodeURIComponent(key)}`,
      key,
    };
  }

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

  const client = new S3Client({
    region: 'auto',
    endpoint: getR2Endpoint(),
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return { url, key };
}

// Get a public URL for a stored file
export function getPublicUrl(key: string): string {
  if (!R2_PUBLIC_URL) {
    return `/api/files/${encodeURIComponent(key)}`;
  }
  return `${R2_PUBLIC_URL}/${key}`;
}

// Generate a unique storage key for a user's file
export function generateStorageKey(userId: string, type: 'photo' | 'clip' | 'music', filename: string, extension: string) {
  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 50);
  return `${type}/${userId}/${timestamp}-${sanitized}.${extension}`;
}
