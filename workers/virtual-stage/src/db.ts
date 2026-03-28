import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function getPool(): Promise<pg.Pool> {
  return pool;
}

// photos.publicUrl stores the R2 storage key (not a URL) — reuse it for staged result
export async function markVirtualStageSuccess(
  photoId: string,
  stagedStorageKey: string
): Promise<void> {
  await pool.query(
    `UPDATE photos
     SET virtualStaged = true,
         publicUrl = $2
     WHERE id = $1`,
    [photoId, stagedStorageKey]
  );
}

export async function markVirtualStageFailed(photoId: string): Promise<void> {
  await pool.query(
    `UPDATE photos
     SET virtualStaged = false
     WHERE id = $1`,
    [photoId]
  );
}
