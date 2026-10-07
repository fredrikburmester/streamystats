CREATE TABLE "user_item_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"item_id" text,
	"source" text NOT NULL,
	"source_key" text NOT NULL,
	"rating" double precision NOT NULL,
	"review" text,
	"rated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_item_ratings_unique" UNIQUE("server_id","user_id","source","source_key")
);
--> statement-breakpoint
ALTER TABLE "user_item_ratings" ADD CONSTRAINT "user_item_ratings_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_item_ratings" ADD CONSTRAINT "user_item_ratings_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_item_ratings_server_user_rating_idx" ON "user_item_ratings" USING btree ("server_id","user_id","rating");--> statement-breakpoint
CREATE INDEX "user_item_ratings_item_idx" ON "user_item_ratings" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_server_date_idx" ON "activities" USING btree ("server_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hidden_recommendations_server_user_idx" ON "hidden_recommendations" USING btree ("server_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_library_id_idx" ON "items" USING btree ("library_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_results_job_id_idx" ON "job_results" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_results_job_name_idx" ON "job_results" USING btree ("job_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_results_created_at_idx" ON "job_results" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "libraries_server_id_idx" ON "libraries" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_item_id_idx" ON "sessions" USING btree ("item_id");