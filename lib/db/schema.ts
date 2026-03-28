import { pgTable, uuid, text, timestamp, integer, boolean, varchar, decimal, jsonb, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Organizations ─────────────────────────────────────────────────────────────
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  ownerUserId: uuid('owner_user_id').notNull(), // references users — set after users table
  plan: varchar('plan', { length: 20 }).notNull().default('starter'), // starter | pro | agency
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Organization Members ───────────────────────────────────────────────────────
export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull().default('agent'), // director | agent
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Organization Invitations ──────────────────────────────────────────────────
export const organizationInvitations = pgTable('organization_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  token: varchar('token', { length: 64 }).notNull().unique(), // nanoid token
  role: varchar('role', { length: 20 }).notNull().default('agent'), // director | agent
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | accepted | expired
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Organization Credits (pool) ────────────────────────────────────────────────
export const organizationCredits = pgTable('organization_credits', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull().default(0), // pool amount
  expiresAt: timestamp('expires_at'), // null = never expires (personal credits); monthly expiry for org-pool
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  passwordHash: text('password_hash'),
  googleId: varchar('google_id', { length: 255 }),
  googleEmail: varchar('google_email', { length: 255 }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  credits: integer('credits').notNull().default(40), // 40 = $10 free (1 credit = $0.25)
  plan: varchar('plan', { length: 20 }).notNull().default('starter'), // starter | pro | scale
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  cdcNumber: varchar('cea_number', { length: 50 }),
  status: varchar('status', { length: 50 }).notNull().default('active'), // active | processing | complete
  clipCount: integer('clip_count').notNull().default(0),
  thumbnailUrl: text('thumbnail_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Photos ───────────────────────────────────────────────────────────────────
export const photos = pgTable('photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  width: integer('width'),
  height: integer('height'),
  order: integer('order').notNull().default(0),
  virtualStaged: boolean('virtual_staged').notNull().default(false),
  skyReplaced: boolean('sky_replaced').notNull().default(false),
  skyStyle: varchar('sky_style', { length: 50 }), // 'blue-sky' | 'golden-hour' | 'twilight' | 'custom' | null
  skyReplacedAt: timestamp('sky_replaced_at'),
  skyStorageKey: text('sky_storage_key'), // R2 key of the sky-replaced version
  publicUrl: text('public_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Clips ────────────────────────────────────────────────────────────────────
export const clips = pgTable('clips', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  photoId: uuid('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key'),
  publicUrl: text('public_url'),
  motionStyle: varchar('motion_style', { length: 50 }).notNull().default('push-in'),
  customPrompt: text('custom_prompt'),
  resolution: varchar('resolution', { length: 10 }).notNull().default('720p'),
  duration: decimal('duration', { precision: 5, scale: 2 }).notNull().default('5.0'),
  status: varchar('status', { length: 50 }).notNull().default('queued'), // queued | processing | done | error
  errorMessage: text('error_message'),
  cost: integer('cost').notNull().default(1), // credits
  jobId: varchar('job_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Auto-Edits ───────────────────────────────────────────────────────────────
export const autoEdits = pgTable('auto_edits', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key'),
  publicUrl: text('public_url'),
  clipIds: jsonb('clip_ids').$type<string[]>().notNull().default([]),
  titleText: varchar('title_text', { length: 255 }),
  musicKey: varchar('music_key', { length: 255 }),
  duration: decimal('duration', { precision: 5, scale: 2 }).notNull().default('0'),
  status: varchar('status', { length: 50 }).notNull().default('draft'), // draft | rendering | done
  cost: integer('cost').notNull().default(1),
  shareToken: varchar('share_token', { length: 64 }),
  shareExpiresAt: timestamp('share_expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Credit Transactions ──────────────────────────────────────────────────────
export const creditTransactions = pgTable('credit_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }), // org-level credit movements
  amount: integer('amount').notNull(), // positive = credit, negative = debit
  type: varchar('type', { length: 50 }).notNull(), // signup | purchase | clip_generation | auto_edit | virtual_staging | sky_replacement | music_generation | org_topup
  referenceId: uuid('reference_id'), // clip_id, photo_id, auto_edit_id, etc.
  description: varchar('description', { length: 255 }),
  stripeEventId: varchar('stripe_event_id', { length: 255 }).unique(), // Stripe event ID for webhook idempotency
  expiresAt: timestamp('expires_at'), // null = never expires (personal credits)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Sessions (simple JWT sessions) ──────────────────────────────────────────
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Password Reset Tokens ─────────────────────────────────────────────────────
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  lookupKey: varchar('lookup_key', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, { fields: [organizations.ownerUserId], references: [users.id] }),
  members: many(organizationMembers),
  invitations: many(organizationInvitations),
  credits: many(organizationCredits),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  org: one(organizations, { fields: [organizationMembers.orgId], references: [organizations.id] }),
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
}));

export const organizationInvitationsRelations = relations(organizationInvitations, ({ one }) => ({
  org: one(organizations, { fields: [organizationInvitations.orgId], references: [organizations.id] }),
}));

export const organizationCreditsRelations = relations(organizationCredits, ({ one }) => ({
  org: one(organizations, { fields: [organizationCredits.orgId], references: [organizations.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  projects: many(projects),
  creditTransactions: many(creditTransactions),
  organization: one(organizations, { fields: [users.organizationId], references: [organizations.id] }),
  organizationMemberships: many(organizationMembers),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  organization: one(organizations, { fields: [projects.organizationId], references: [organizations.id] }),
  photos: many(photos),
  clips: many(clips),
  autoEdits: many(autoEdits),
}));

export const photosRelations = relations(photos, ({ one, many }) => ({
  project: one(projects, { fields: [photos.projectId], references: [projects.id] }),
  clips: many(clips),
}));

export const clipsRelations = relations(clips, ({ one }) => ({
  project: one(projects, { fields: [clips.projectId], references: [projects.id] }),
  photo: one(photos, { fields: [clips.photoId], references: [photos.id] }),
}));

export const autoEditsRelations = relations(autoEdits, ({ one }) => ({
  project: one(projects, { fields: [autoEdits.projectId], references: [projects.id] }),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(users, { fields: [creditTransactions.userId], references: [users.id] }),
  organization: one(organizations, { fields: [creditTransactions.organizationId], references: [organizations.id] }),
}));
