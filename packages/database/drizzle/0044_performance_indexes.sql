CREATE INDEX IF NOT EXISTS "libraries_server_id_idx" ON "libraries" ("server_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_server_date_idx" ON "activities" ("server_id", "date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_results_job_id_idx" ON "job_results" ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_results_job_name_idx" ON "job_results" ("job_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_results_created_at_idx" ON "job_results" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_library_id_idx" ON "items" ("library_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_item_id_idx" ON "sessions" ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hidden_recommendations_server_user_idx" ON "hidden_recommendations" ("server_id", "user_id");--> statement-breakpoint
DROP INDEX IF EXISTS "items_deleted_at_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_deleted_at_idx" ON "items" ("deleted_at") WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_active_server_type_idx" ON "items" ("server_id", "type") WHERE "deleted_at" IS NULL;
