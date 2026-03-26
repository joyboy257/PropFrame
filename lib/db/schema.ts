import { pgTable, uuid, text, timestamp, integer, boolean, varchar, decimal, jsonb, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  passwordHash: text('password_hash'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  credits: integer('credits').notNull().default(1000), // 1000 = $10 free
  plan: varchar('plan', { length: 20 }).notNull().default('starter'), // starter | pro | scale
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Credit Transactions ──────────────────────────────────────────────────────
export const creditTransactions = pgTable('credit_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(), // positive = credit, negative = debit
  type: varchar('type', { length: 50 }).notNull(), // signup | purchase | clip_generation | auto_edit | virtual_staging | sky_replacement | music_generation
  referenceId: uuid('reference_id'), // clip_id, photo_id, auto_edit_id, etc.
  description: varchar('description', { length: 255 }),
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

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  creditTransactions: many(creditTransactions),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
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
}));
