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
ALTER TABLE "user_item_ratings" ADD CONSTRAINT "user_item_ratings_items_server_fk" FOREIGN KEY ("server_id","item_id") REFERENCES "public"."items"("server_id","id") ON DELETE SET NULL ("item_id") ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_item_ratings_server_user_rating_idx" ON "user_item_ratings" USING btree ("server_id","user_id","rating");--> statement-breakpoint
CREATE INDEX "user_item_ratings_item_idx" ON "user_item_ratings" USING btree ("item_id");