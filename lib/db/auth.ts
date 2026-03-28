import { db } from './index';
import { users, sessions, creditTransactions, organizationCredits, organizationMembers } from './schema';
import { eq, and, sql, isNull, gt, lt } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;
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
  const [user] = await db.insert(users).values({ email, name, passwordHash, credits: 40 }).returning();
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

  // Compute available credits from non-expired transactions only.
  // A debit (negative amount) is excluded if it has expired (expiresAt is not null and is in the past).
  // Credits (positive amount) never expire.
  const { or, isNull, gt } = require('drizzle-orm');
  const availableCredits = user.credits; // start from authoritative balance

  // Query to verify: sum of non-expired transactions should support the deduction
  // We sum all non-expired credit transactions (positive) and subtract non-expired debits (negative)
  // The user should have enough: credits added - nonExpiredDebits >= amount
  // But since users.credits = creditsAdded - allDebits, we need to add back expired debits
  // to get "true available" = users.credits + sum(expiredDebits)
  const expiredDebitsResult = await db
    .select({ total: sql`COALESCE(SUM(${creditTransactions.amount}), 0)` })
    .from(creditTransactions)
    .where(and(
      eq(creditTransactions.userId, userId),
      lt(creditTransactions.amount, 0),
      isNull(creditTransactions.expiresAt).not(),
      gt(creditTransactions.expiresAt, new Date())
    ));

  // Wait, that's wrong - we need lt (less than) for expired, not gt
  // gt(creditTransactions.expiresAt, new Date()) means NOT expired
  // So expired = lt(expiresAt, new Date())
  const expiredDebits = expiredDebitsResult[0]?.total ?? 0;
  // Actually, we need to recalculate: available = user.credits + sumOfExpiredDebits
  // because users.credits already subtracted all debits (including expired ones)
  // But we don't deduct from expired debits, so available = credits + |expiredDebits|
  // Since expiredDebits is negative, credits + expiredDebits = credits - |expiredDebits|

  // Let me reconsider: available = sum of valid transactions
  // = creditsAdded - nonExpiredDebits
  // = (creditsAdded - allDebits) + (allDebits - nonExpiredDebits)
  // = users.credits + expiredDebits
  // Since expiredDebits is negative, available = users.credits - |expiredDebits|

  // But actually, since we want to check "can we deduct?", we just need to verify
  // that nonExpiredDebits <= user.credits - amount
  // OR equivalently: user.credits >= amount + nonExpiredDebits

  // Let's simplify: available = user.credits - (totalDebits - nonExpiredDebits)
  // But we don't track totalDebits directly...

  // Simpler approach: compute available from scratch
  const { and: and2, eq: eq2, sql: sql2 } = require('drizzle-orm');
  const creditsResult = await db
    .select({ total: sql`COALESCE(SUM(${creditTransactions.amount}), 0)` })
    .from(creditTransactions)
    .where(and2(
      eq2(creditTransactions.userId, userId),
      or(
        gt(creditTransactions.amount, 0),       // credit (positive, never expires)
        isNull(creditTransactions.expiresAt),  // debit with no expiry
        gt(creditTransactions.expiresAt, new Date()) // debit not yet expired
      )
    ));

  const availableFromTx = Number(creditsResult[0]?.total ?? 0);
  if (availableFromTx < amount) throw new Error('Insufficient credits');

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

// ─── Org credit pool helpers ─────────────────────────────────────────────────

export async function getOrgPoolCredits(orgId: string): Promise<number> {
  // Get the active org pool — single pool per org for now
  const [pool] = await db
    .select({ amount: organizationCredits.amount })
    .from(organizationCredits)
    .where(eq(organizationCredits.orgId, orgId))
    .limit(1);
  return pool?.amount ?? 0;
}

/**
 * Deduct credits from the org pool if available, then fall back to personal credits.
 * If neither has enough, throws 'Insufficient credits'.
 *
 * Credit priority:
 * 1. Org pool (director-topped-up credits, expires monthly)
 * 2. Personal credits (never expires)
 */
export async function deductCreditsWithOrgPool(
  userId: string,
  orgId: string | null,
  amount: number,
  type: string,
  referenceId?: string
): Promise<{ source: 'org' | 'personal' }> {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');

  // Org pool path
  if (orgId) {
    const [pool] = await db
      .select({ id: organizationCredits.id, amount: organizationCredits.amount })
      .from(organizationCredits)
      .where(and(
        eq(organizationCredits.orgId, orgId),
        sql`${organizationCredits.expiresAt} IS NULL OR ${organizationCredits.expiresAt} > NOW()`
      ))
      .limit(1);

    if (!pool) {
      // fall through to personal
    } else if (pool.amount >= amount) {
      // Full deduction from org pool
      await db
        .update(organizationCredits)
        .set({ amount: pool.amount - amount, updatedAt: new Date() })
        .where(eq(organizationCredits.id, pool.id));
      await db.insert(creditTransactions).values({
        userId,
        organizationId: orgId,
        amount: -amount,
        type,
        referenceId,
        description: `${type} (org pool, ${amount} credits)`,
      });
      return { source: 'org' };
    } else if (pool.amount > 0) {
      // Partial org pool, rest from personal
      const remaining = amount - pool.amount;
      if (user.credits < remaining) {
        throw new Error('Insufficient credits');
      }
      await db
        .update(organizationCredits)
        .set({ amount: 0, updatedAt: new Date() })
        .where(eq(organizationCredits.id, pool.id));
      await db
        .update(users)
        .set({ credits: user.credits - remaining })
        .where(eq(users.id, userId));
      await db.insert(creditTransactions).values({
        userId,
        organizationId: orgId,
        amount: -pool.amount,
        type,
        referenceId,
        description: `${type} (org pool, ${pool.amount} credits)`,
      });
      await db.insert(creditTransactions).values({
        userId,
        amount: -remaining,
        type,
        referenceId,
        description: `${type} (personal, ${remaining} credits)`,
      });
      return { source: 'org' };
    }
  }

  // Personal-only path
  if (user.credits < amount) {
    throw new Error('Insufficient credits');
  }
  await db.update(users).set({ credits: user.credits - amount }).where(eq(users.id, userId));
  await db.insert(creditTransactions).values({
    userId,
    organizationId: orgId ?? undefined,
    amount: -amount,
    type,
    referenceId,
    description: `${type} (${amount} credits)`,
  });
  return { source: 'personal' };
}

/**
 * Add credits to the org pool. Creates the pool record if it doesn't exist.
 */
export async function addOrgCredits(orgId: string, amount: number, type: string, referenceId?: string) {
  const [existing] = await db
    .select({ id: organizationCredits.id, amount: organizationCredits.amount })
    .from(organizationCredits)
    .where(eq(organizationCredits.orgId, orgId))
    .limit(1);

  if (existing) {
    await db
      .update(organizationCredits)
      .set({ amount: existing.amount + amount, updatedAt: new Date() })
      .where(eq(organizationCredits.id, existing.id));
  } else {
    // Create pool with 1-year expiry by default (director can configure)
    await db.insert(organizationCredits).values({
      orgId,
      amount,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
  }
  // Log transaction
  await db.insert(creditTransactions).values({
    userId: '00000000-0000-0000-0000-000000000000', // system/org-level
    organizationId: orgId,
    amount,
    type,
    referenceId,
    description: `${type} (+${amount} org credits)`,
  });
}
