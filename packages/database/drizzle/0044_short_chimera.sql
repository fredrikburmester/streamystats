CREATE TABLE "item_edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"source_item_id" text NOT NULL,
	"target_item_id" text NOT NULL,
	"edge_type" text NOT NULL,
	"weight" double precision NOT NULL,
	"metadata" jsonb,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_edges_unique" UNIQUE("server_id","source_item_id","target_item_id","edge_type")
);
--> statement-breakpoint
CREATE TABLE "user_taste_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"taste_embedding" vector,
	"genre_weights" jsonb,
	"decade_weights" jsonb,
	"people_affinities" jsonb,
	"preferred_runtime_mins" double precision,
	"rating_affinity" double precision,
	"novelty_score" double precision,
	"completion_rate" double precision,
	"watched_item_count" integer DEFAULT 0 NOT NULL,
	"total_watch_seconds" bigint DEFAULT 0 NOT NULL,
	"anchor_items" jsonb,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_taste_profiles_unique" UNIQUE("server_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "item_edges" ADD CONSTRAINT "item_edges_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_edges" ADD CONSTRAINT "item_edges_source_item_id_items_id_fk" FOREIGN KEY ("source_item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_edges" ADD CONSTRAINT "item_edges_target_item_id_items_id_fk" FOREIGN KEY ("target_item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_taste_profiles" ADD CONSTRAINT "user_taste_profiles_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_edges_source_idx" ON "item_edges" USING btree ("server_id","source_item_id");--> statement-breakpoint
CREATE INDEX "item_edges_target_idx" ON "item_edges" USING btree ("server_id","target_item_id");--> statement-breakpoint
CREATE INDEX "user_taste_profiles_server_idx" ON "user_taste_profiles" USING btree ("server_id");