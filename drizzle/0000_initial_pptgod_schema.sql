CREATE SCHEMA "pptgod";
--> statement-breakpoint
CREATE TABLE "pptgod"."accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pptgod"."auth_rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "pptgod"."prompt_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"prompt_id" text NOT NULL,
	"user_id" text NOT NULL,
	"tested_tool" text DEFAULT 'claude-html' NOT NULL,
	"rating" integer DEFAULT 5 NOT NULL,
	"content" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pptgod"."prompt_favorites" (
	"user_id" text NOT NULL,
	"prompt_id" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "prompt_favorites_user_id_prompt_id_pk" PRIMARY KEY("user_id","prompt_id")
);
--> statement-breakpoint
CREATE TABLE "pptgod"."prompt_likes" (
	"user_id" text NOT NULL,
	"prompt_id" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "prompt_likes_user_id_prompt_id_pk" PRIMARY KEY("user_id","prompt_id")
);
--> statement-breakpoint
CREATE TABLE "pptgod"."prompts" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"english_title" text NOT NULL,
	"summary" text NOT NULL,
	"scenario" text NOT NULL,
	"style_category" text NOT NULL,
	"color_family" text NOT NULL,
	"recommended_tools" jsonb NOT NULL,
	"tags" jsonb NOT NULL,
	"visual_spec" jsonb NOT NULL,
	"prompt_anatomy" jsonb NOT NULL,
	"custom_notes" text DEFAULT '' NOT NULL,
	"sample_topic" text NOT NULL,
	"sample_subtitle" text NOT NULL,
	"author_id" text NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"remixed_from_id" text,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"saves_count" integer DEFAULT 0 NOT NULL,
	"copies_count" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "prompts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pptgod"."saved_decks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"prompt_id" text NOT NULL,
	"prompt_slug" text NOT NULL,
	"prompt_title" text NOT NULL,
	"visual_spec" jsonb NOT NULL,
	"slides_json" jsonb NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"author_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pptgod"."sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pptgod"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"display_name" text NOT NULL,
	"image" text,
	"username" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avatar_color" text DEFAULT '#C84B31' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "pptgod"."verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pptgod"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pptgod"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pptgod"."prompt_comments" ADD CONSTRAINT "prompt_comments_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "pptgod"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pptgod"."prompt_comments" ADD CONSTRAINT "prompt_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pptgod"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pptgod"."prompt_favorites" ADD CONSTRAINT "prompt_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pptgod"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pptgod"."prompt_favorites" ADD CONSTRAINT "prompt_favorites_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "pptgod"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pptgod"."prompt_likes" ADD CONSTRAINT "prompt_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pptgod"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pptgod"."prompt_likes" ADD CONSTRAINT "prompt_likes_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "pptgod"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pptgod"."prompts" ADD CONSTRAINT "prompts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "pptgod"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pptgod"."saved_decks" ADD CONSTRAINT "saved_decks_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "pptgod"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pptgod"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pptgod"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_user" ON "pptgod"."accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_accounts_provider_account" ON "pptgod"."accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_comments_prompt" ON "pptgod"."prompt_comments" USING btree ("prompt_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_comments_user" ON "pptgod"."prompt_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_favorites_prompt" ON "pptgod"."prompt_favorites" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "idx_likes_prompt" ON "pptgod"."prompt_likes" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "idx_prompts_scenario" ON "pptgod"."prompts" USING btree ("scenario");--> statement-breakpoint
CREATE INDEX "idx_prompts_style" ON "pptgod"."prompts" USING btree ("style_category");--> statement-breakpoint
CREATE INDEX "idx_prompts_color" ON "pptgod"."prompts" USING btree ("color_family");--> statement-breakpoint
CREATE INDEX "idx_prompts_created" ON "pptgod"."prompts" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_prompts_author_public" ON "pptgod"."prompts" USING btree ("author_id","is_public");--> statement-breakpoint
CREATE INDEX "idx_decks_author" ON "pptgod"."saved_decks" USING btree ("author_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "pptgod"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_verifications_identifier" ON "pptgod"."verifications" USING btree ("identifier");