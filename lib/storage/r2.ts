import { S3Client } from '@aws-sdk/client-s3';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

const R2_BUCKET = process.env.NEXT_PUBLIC_R2_BUCKET!;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;

export function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.dev`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function deleteObject(storageKey: string): Promise<void> {
  const client = getR2Client();
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: storageKey,
  });
  await client.send(command);
}
