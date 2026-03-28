import { db } from './index';
import { users, sessions, creditTransactions } from './schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'dev-secret-change-in-production';
const SESSION_EXPIRY_DAYS = 7;

export function signToken(userId: string, tokenId: string): string {
  return jwt.sign({ userId, tokenId }, JWT_SECRET, { expiresIn: `${SESSION_EXPIRY_DAYS}d` });
}

export function verifyToken(token: string): { userId: string; tokenId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; tokenId: string };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createUser(email: string, name?: string, password?: string) {
  const passwordHash = password ? await hashPassword(password) : null;
  const [user] = await db.insert(users).values({ email, name, passwordHash, credits: 1000 }).returning();
  return user;
}

export async function getUserByEmail(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] || null;
}

export async function getUserById(id: string) {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}

export async function createSession(userId: string) {
  const tokenId = nanoid(32);
  const token = signToken(userId, tokenId);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({ userId, tokenHash: tokenId, expiresAt });

  return { token, expiresAt };
}

export async function getSession(token: string) {
  const payload = verifyToken(token);
  if (!payload) return null;

  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, payload.tokenId))
    .limit(1);

  const session = result[0];
  if (!session || session.expiresAt < new Date()) {
    if (session) await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }

  return session;
}

export async function deleteSession(token: string) {
  const payload = verifyToken(token);
  if (!payload) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, payload.tokenId));
}

export async function deleteAllUserSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function getUserCredits(userId: string): Promise<number> {
  const result = await db
    .select({ credits: users.credits })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return result[0]?.credits ?? 0;
}

export async function deductCredits(userId: string, amount: number, type: string, referenceId?: string) {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');
  if (user.credits < amount) throw new Error('Insufficient credits');

  await db.update(users).set({ credits: user.credits - amount }).where(eq(users.id, userId));
  await db.insert(creditTransactions).values({
    userId,
    amount: -amount,
    type,
    referenceId,
    description: `${type} (${amount} credits)`,
  });
}

export async function addCredits(userId: string, amount: number, type: string, referenceId?: string) {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');

  await db.update(users).set({ credits: user.credits + amount }).where(eq(users.id, userId));
  await db.insert(creditTransactions).values({
    userId,
    amount,
    type,
    referenceId,
    description: `${type} (+${amount} credits)`,
  });
}

export async function authenticate(token: string) {
  const session = await getSession(token);
  if (!session) return null;
  return getUserById(session.userId);
}
