import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Better Auth tables (user, session, account, verification)
// ---------------------------------------------------------------------------
// These are declared here so the Drizzle adapter in
// apps/api/src/middleware/auth.ts can resolve the relations.
// Schema mirrors better-auth's canonical postgres schema.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// ---------------------------------------------------------------------------
// Application tables
// ---------------------------------------------------------------------------

export const toolCategories = pgTable("tool_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color").notNull().default("#FF4500"),
});

export const tools = pgTable("tools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: varchar("category_id").notNull().references(() => toolCategories.id),
  url: text("url"),
  frameworks: jsonb("frameworks").$type<string[]>().default([]),
  languages: jsonb("languages").$type<string[]>().default([]),
  features: jsonb("features").$type<string[]>().default([]),
  integrations: jsonb("integrations").$type<string[]>().default([]),
  maturityScore: real("maturity_score").notNull().default(0),
  popularityScore: real("popularity_score").notNull().default(0),
  pricing: text("pricing"),
  notes: text("notes"),
  setupComplexity: text("setup_complexity").default("medium"),
  costTier: text("cost_tier").default("free"),
  performanceImpact: jsonb("performance_impact").$type<{ buildTime?: string; bundleSize?: string }>(),
  apiLastSync: timestamp("api_last_sync", { mode: "date" }),
});

export const compatibilities = pgTable("compatibilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  toolOneId: varchar("tool_one_id").notNull().references(() => tools.id),
  toolTwoId: varchar("tool_two_id").notNull().references(() => tools.id),
  compatibilityScore: real("compatibility_score").notNull(),
  notes: text("notes"),
  verifiedIntegration: integer("verified_integration").notNull().default(0),
  integrationDifficulty: text("integration_difficulty").default("medium"),
  setupSteps: jsonb("setup_steps").$type<string[]>(),
  codeExample: text("code_example"),
  dependencies: jsonb("dependencies").$type<string[]>(),
});

export const stackTemplates = pgTable("stack_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  toolIds: jsonb("tool_ids").$type<string[]>().notNull(),
  useCase: text("use_case").notNull(),
  setupComplexity: text("setup_complexity").notNull().default("medium"),
  estimatedCost: text("estimated_cost"),
  pros: jsonb("pros").$type<string[]>(),
  cons: jsonb("cons").$type<string[]>(),
  harmonyScore: integer("harmony_score").notNull(),
  popularityRank: integer("popularity_rank").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const toolCategoryJunction = pgTable("tool_category_junction", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  toolId: varchar("tool_id").notNull().references(() => tools.id, { onDelete: "cascade" }),
  categoryId: varchar("category_id").notNull().references(() => toolCategories.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").default(false),
});

export const stackRules = pgTable("stack_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  ruleType: text("rule_type").notNull(),
  categoryId: varchar("category_id").references(() => toolCategories.id),
  condition: jsonb("condition").notNull(),
  priority: integer("priority").default(0),
  active: boolean("active").default(true),
});

export const migrationPaths = pgTable("migration_paths", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromToolId: varchar("from_tool_id").notNull().references(() => tools.id),
  toToolId: varchar("to_tool_id").notNull().references(() => tools.id),
  difficulty: text("difficulty").notNull(),
  estimatedTime: text("estimated_time"),
  steps: jsonb("steps").$type<string[]>().notNull(),
  considerations: jsonb("considerations").$type<string[]>(),
  dataPortability: integer("data_portability").notNull(),
});

export const toolCategoriesRelations = relations(toolCategories, ({ many }) => ({
  tools: many(tools),
  toolJunctions: many(toolCategoryJunction),
}));

export const toolsRelations = relations(tools, ({ one, many }) => ({
  category: one(toolCategories, {
    fields: [tools.categoryId],
    references: [toolCategories.id],
  }),
  toolJunctions: many(toolCategoryJunction),
  compatibilitiesAsToolOne: many(compatibilities, { relationName: "toolOne" }),
  compatibilitiesAsToolTwo: many(compatibilities, { relationName: "toolTwo" }),
}));

export const toolCategoryJunctionRelations = relations(toolCategoryJunction, ({ one }) => ({
  tool: one(tools, {
    fields: [toolCategoryJunction.toolId],
    references: [tools.id],
  }),
  category: one(toolCategories, {
    fields: [toolCategoryJunction.categoryId],
    references: [toolCategories.id],
  }),
}));

export const compatibilitiesRelations = relations(compatibilities, ({ one }) => ({
  toolOne: one(tools, {
    fields: [compatibilities.toolOneId],
    references: [tools.id],
    relationName: "toolOne",
  }),
  toolTwo: one(tools, {
    fields: [compatibilities.toolTwoId],
    references: [tools.id],
    relationName: "toolTwo",
  }),
}));

export const insertToolCategorySchema = createInsertSchema(toolCategories).omit({ id: true });
export const insertToolSchema = createInsertSchema(tools).omit({ id: true });
export const insertCompatibilitySchema = createInsertSchema(compatibilities).omit({ id: true });
export const insertStackTemplateSchema = createInsertSchema(stackTemplates).omit({ id: true, createdAt: true });
export const insertStackRuleSchema = createInsertSchema(stackRules).omit({ id: true });
export const insertMigrationPathSchema = createInsertSchema(migrationPaths).omit({ id: true });
export const insertToolCategoryJunctionSchema = createInsertSchema(toolCategoryJunction).omit({ id: true });

export type ToolCategoryRecord = typeof toolCategories.$inferSelect;
export type ToolRecord = typeof tools.$inferSelect;
export type CompatibilityRecord = typeof compatibilities.$inferSelect;
export type StackTemplateRecord = typeof stackTemplates.$inferSelect;
export type StackRuleRecord = typeof stackRules.$inferSelect;
export type MigrationPathRecord = typeof migrationPaths.$inferSelect;
export type ToolCategoryJunctionRecord = typeof toolCategoryJunction.$inferSelect;

export type InsertToolCategory = z.infer<typeof insertToolCategorySchema>;
export type InsertTool = z.infer<typeof insertToolSchema>;
export type InsertCompatibility = z.infer<typeof insertCompatibilitySchema>;
export type InsertStackTemplate = z.infer<typeof insertStackTemplateSchema>;
export type InsertStackRule = z.infer<typeof insertStackRuleSchema>;
export type InsertMigrationPath = z.infer<typeof insertMigrationPathSchema>;
export type InsertToolCategoryJunction = z.infer<typeof insertToolCategoryJunctionSchema>;

export type ToolWithCategory = ToolRecord & {
  category: ToolCategoryRecord;
};

export type CompatibilityMatrix = {
  toolOne: ToolWithCategory;
  toolTwo: ToolWithCategory;
  compatibility: CompatibilityRecord;
};
