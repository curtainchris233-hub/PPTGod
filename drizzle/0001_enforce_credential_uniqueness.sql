ALTER TABLE "pptgod"."auth_rate_limits" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "pptgod"."auth_rate_limits" CASCADE;--> statement-breakpoint
DROP INDEX "pptgod"."idx_accounts_provider_account";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_accounts_provider_account" ON "pptgod"."accounts" USING btree ("provider_id","account_id");