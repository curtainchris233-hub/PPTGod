import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  ColorFamily,
  DeckSlideItem,
  PromptAnatomy,
  TargetTool,
  VisualSpec,
} from "@/types/prompt";

// Only the Next.js server connects to this schema. Supabase's Data API
// exposes neither the account tables nor private styles and presentations.
export const pptgodSchema = pgSchema("pptgod");

const authTimestamp = (name: string) => timestamp(name, { withTimezone: true });

export const users = pptgodSchema.table("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("display_name").notNull(),
  image: text("image"),
  username: text("username").notNull().unique(),
  bio: text("bio").notNull().default(""),
  avatarColor: text("avatar_color").notNull().default("#C84B31"),
  createdAt: authTimestamp("created_at").notNull().defaultNow(),
  updatedAt: authTimestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pptgodSchema.table("sessions", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: authTimestamp("expires_at").notNull(),
  createdAt: authTimestamp("created_at").notNull().defaultNow(),
  updatedAt: authTimestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
}, (table) => [index("idx_sessions_user").on(table.userId)]);

export const accounts = pptgodSchema.table("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: authTimestamp("access_token_expires_at"),
  refreshTokenExpiresAt: authTimestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: authTimestamp("created_at").notNull().defaultNow(),
  updatedAt: authTimestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_accounts_user").on(table.userId),
  uniqueIndex("idx_accounts_provider_account").on(table.providerId, table.accountId),
]);

export const verifications = pptgodSchema.table("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: authTimestamp("expires_at").notNull(),
  createdAt: authTimestamp("created_at").notNull().defaultNow(),
  updatedAt: authTimestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("idx_verifications_identifier").on(table.identifier)]);

export const prompts = pptgodSchema.table("prompts", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  englishTitle: text("english_title").notNull(),
  summary: text("summary").notNull(),
  scenario: text("scenario").notNull(),
  styleCategory: text("style_category").notNull(),
  colorFamily: text("color_family").$type<ColorFamily>().notNull(),
  recommendedTools: jsonb("recommended_tools").$type<TargetTool[]>().notNull(),
  tags: jsonb("tags").$type<string[]>().notNull(),
  visualSpec: jsonb("visual_spec").$type<VisualSpec>().notNull(),
  promptAnatomy: jsonb("prompt_anatomy").$type<PromptAnatomy>().notNull(),
  customNotes: text("custom_notes").notNull().default(""),
  sampleTopic: text("sample_topic").notNull(),
  sampleSubtitle: text("sample_subtitle").notNull(),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isOfficial: boolean("is_official").notNull().default(false),
  isPublic: boolean("is_public").notNull().default(true),
  remixedFromId: text("remixed_from_id"),
  likesCount: integer("likes_count").notNull().default(0),
  savesCount: integer("saves_count").notNull().default(0),
  copiesCount: integer("copies_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_prompts_scenario").on(table.scenario),
  index("idx_prompts_style").on(table.styleCategory),
  index("idx_prompts_color").on(table.colorFamily),
  index("idx_prompts_created").on(table.createdAt.desc()),
  index("idx_prompts_author_public").on(table.authorId, table.isPublic),
]);

export const promptLikes = pptgodSchema.table("prompt_likes", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  promptId: text("prompt_id").notNull().references(() => prompts.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.promptId] }),
  index("idx_likes_prompt").on(table.promptId),
]);

export const promptFavorites = pptgodSchema.table("prompt_favorites", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  promptId: text("prompt_id").notNull().references(() => prompts.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.promptId] }),
  index("idx_favorites_prompt").on(table.promptId),
]);

export const promptComments = pptgodSchema.table("prompt_comments", {
  id: text("id").primaryKey(),
  promptId: text("prompt_id").notNull().references(() => prompts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  testedTool: text("tested_tool").$type<TargetTool>().notNull().default("claude-html"),
  rating: integer("rating").notNull().default(5),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_comments_prompt").on(table.promptId, table.createdAt.desc()),
  index("idx_comments_user").on(table.userId),
]);

export const savedDecks = pptgodSchema.table("saved_decks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  audience: text("audience").notNull().default(""),
  promptId: text("prompt_id").notNull(),
  promptSlug: text("prompt_slug").notNull(),
  promptTitle: text("prompt_title").notNull(),
  visualSpec: jsonb("visual_spec").$type<VisualSpec>().notNull(),
  slides: jsonb("slides_json").$type<DeckSlideItem[]>().notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_decks_author").on(table.authorId, table.updatedAt.desc())]);
