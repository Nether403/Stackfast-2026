import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const toolCategories = pgTable("tool_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color").notNull().default("#FF4500"), // neon-orange default
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
  // New fields for enhanced functionality
  setupComplexity: text("setup_complexity").default("medium"), // easy, medium, hard
  costTier: text("cost_tier").default("free"), // free, freemium, paid, enterprise
  performanceImpact: jsonb("performance_impact").$type<{ buildTime?: string; bundleSize?: string }>(), // { buildTime: 'low', bundleSize: 'medium' }
  apiLastSync: timestamp("api_last_sync", { mode: 'date' }), // Track last API sync time
});

export const compatibilities = pgTable("compatibilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  toolOneId: varchar("tool_one_id").notNull().references(() => tools.id),
  toolTwoId: varchar("tool_two_id").notNull().references(() => tools.id),
  compatibilityScore: real("compatibility_score").notNull(),
  notes: text("notes"),
  verifiedIntegration: integer("verified_integration").notNull().default(0), // 0 = false, 1 = true
  // New fields for richer compatibility data
  integrationDifficulty: text("integration_difficulty").default("medium"), // easy, medium, hard
  setupSteps: jsonb("setup_steps").$type<string[]>(), // Array of setup instructions
  codeExample: text("code_example"), // Sample integration code
  dependencies: jsonb("dependencies").$type<string[]>(), // Required dependencies for integration
});

// New table for Stack Templates
export const stackTemplates = pgTable("stack_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // e.g., "AI-Powered SaaS", "Rapid Prototyping"
  toolIds: jsonb("tool_ids").$type<string[]>().notNull(),
  useCase: text("use_case").notNull(),
  setupComplexity: text("setup_complexity").notNull().default("medium"),
  estimatedCost: text("estimated_cost"), // e.g., "$0-50/month"
  pros: jsonb("pros").$type<string[]>(),
  cons: jsonb("cons").$type<string[]>(),
  harmonyScore: integer("harmony_score").notNull(), // Overall compatibility score for the stack
  popularityRank: integer("popularity_rank").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Junction table for tools and categories (many-to-many)
export const toolCategoryJunction = pgTable("tool_category_junction", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  toolId: varchar("tool_id").notNull().references(() => tools.id, { onDelete: "cascade" }),
  categoryId: varchar("category_id").notNull().references(() => toolCategories.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").default(false), // Mark the primary category
});

// New table for Stack Validation Rules
export const stackRules = pgTable("stack_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  ruleType: text("rule_type").notNull(), // conflict, dependency, recommendation
  categoryId: varchar("category_id").references(() => toolCategories.id),
  condition: jsonb("condition").notNull(), // JSON rule definition
  priority: integer("priority").default(0),
  active: boolean("active").default(true),
});

// New table for Migration Paths
export const migrationPaths = pgTable("migration_paths", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromToolId: varchar("from_tool_id").notNull().references(() => tools.id),
  toToolId: varchar("to_tool_id").notNull().references(() => tools.id),
  difficulty: text("difficulty").notNull(), // easy, medium, hard, expert
  estimatedTime: text("estimated_time"), // e.g., "1-2 days", "1 week"
  steps: jsonb("steps").$type<string[]>().notNull(), // Array of migration steps
  considerations: jsonb("considerations").$type<string[]>(),
  dataPortability: integer("data_portability").notNull(), // 0-100 score
});

// Define relations
export const toolCategoriesRelations = relations(toolCategories, ({ many }) => ({
  tools: many(tools), // Keep for backward compatibility
  toolJunctions: many(toolCategoryJunction),
}));

export const toolsRelations = relations(tools, ({ one, many }) => ({
  category: one(toolCategories, { // Keep for backward compatibility (primary category)
    fields: [tools.categoryId],
    references: [toolCategories.id],
  }),
  toolJunctions: many(toolCategoryJunction),
  compatibilitiesAsToolOne: many(compatibilities, {
    relationName: "toolOne",
  }),
  compatibilitiesAsToolTwo: many(compatibilities, {
    relationName: "toolTwo",
  }),
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

// Insert schemas
export const insertToolCategorySchema = createInsertSchema(toolCategories).omit({
  id: true,
});

export const insertToolSchema = createInsertSchema(tools).omit({
  id: true,
});

export const insertCompatibilitySchema = createInsertSchema(compatibilities).omit({
  id: true,
});

export const insertStackTemplateSchema = createInsertSchema(stackTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertStackRuleSchema = createInsertSchema(stackRules).omit({
  id: true,
});

export const insertMigrationPathSchema = createInsertSchema(migrationPaths).omit({
  id: true,
});

export const insertToolCategoryJunctionSchema = createInsertSchema(toolCategoryJunction).omit({
  id: true,
});

// Types
export type ToolCategory = typeof toolCategories.$inferSelect;
export type Tool = typeof tools.$inferSelect;
export type Compatibility = typeof compatibilities.$inferSelect;
export type StackTemplate = typeof stackTemplates.$inferSelect;
export type StackRule = typeof stackRules.$inferSelect;
export type MigrationPath = typeof migrationPaths.$inferSelect;
export type ToolCategoryJunction = typeof toolCategoryJunction.$inferSelect;

export type InsertToolCategory = z.infer<typeof insertToolCategorySchema>;
export type InsertTool = z.infer<typeof insertToolSchema>;
export type InsertCompatibility = z.infer<typeof insertCompatibilitySchema>;
export type InsertStackTemplate = z.infer<typeof insertStackTemplateSchema>;
export type InsertStackRule = z.infer<typeof insertStackRuleSchema>;
export type InsertMigrationPath = z.infer<typeof insertMigrationPathSchema>;
export type InsertToolCategoryJunction = z.infer<typeof insertToolCategoryJunctionSchema>;

// Extended types for frontend
export type ToolWithCategory = Tool & {
  category: ToolCategory;
};

export type CompatibilityMatrix = {
  toolOne: ToolWithCategory;
  toolTwo: ToolWithCategory;
  compatibility: Compatibility;
};
