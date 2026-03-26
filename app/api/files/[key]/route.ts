import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/db/auth';

export const runtime = 'nodejs';

// GET /api/files/[...key] — serve R2 files with ownership check
// URL pattern: /api/files/photos/<userId>/<timestamp>-<filename>.<ext>
// Falls back to 404 when R2 is not configured.
export async function GET(
  req: NextRequest,
  { params }: { params: { key: string[] } }
) {
  const token = req.cookies.get('session_token')?.value || req.cookies.get('dev_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const key = (params.key || []).join('/');
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Ownership check: key must contain the user's own ID
  if (!key.includes(payload.userId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const R2_BUCKET = process.env.NEXT_PUBLIC_R2_BUCKET || 'vugru-media';

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    // Dev: no R2 configured — return a placeholder SVG
    return new NextResponse(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="#1e293b" width="400" height="300"/><text fill="#64748b" font-family="sans-serif" font-size="14" x="50%" y="50%" text-anchor="middle" dy=".3em">R2 not configured</text></svg>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // Production: stream from R2 using S3 GET
  try {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.dev`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    });

    const response = await client.send(command);

    const contentType = response.ContentType || 'application/octet-stream';

    // Stream the R2 response body
    const stream = response.Body;

    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    // Return a streaming response — cast SdkStream to ReadableStream (compatible with Response body)
    return new Response(stream as unknown as ReadableStream, { headers });
  } catch (err: unknown) {
    const error = err as { name?: string };
    if (error.name === 'NoSuchKey') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('R2 GET error:', err);
    return NextResponse.json({ error: 'Failed to retrieve file' }, { status: 500 });
  }
}
