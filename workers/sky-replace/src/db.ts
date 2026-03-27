import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function getPool(): Promise<pg.Pool> {
  return pool;
}

export async function updatePhotoSkyDone(
  photoId: string,
  skyStorageKey: string,
  skyPublicUrl: string
): Promise<void> {
  await pool.query(
    `UPDATE photos 
     SET skyReplaced = true, 
         skyStorageKey = $2, 
         skyPublicUrl = $3 
     WHERE id = $1`,
    [photoId, skyStorageKey, skyPublicUrl]
  );
}

export async function updatePhotoSkyError(photoId: string): Promise<void> {
  await pool.query(
    `UPDATE photos 
     SET skyReplaced = false 
     WHERE id = $1`,
    [photoId]
  );
}

export async function refundCredits(userId: string, photoId: string): Promise<void> {
  await pool.query(
    `INSERT INTO credit_transactions (userId, amount, type, referenceId, description)
     VALUES ($1, $2, 'sky_replacement', $3, 'Refund for failed sky replacement')`,
    [userId, 1, photoId]
  );
}
