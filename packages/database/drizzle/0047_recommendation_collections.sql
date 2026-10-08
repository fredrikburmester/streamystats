CREATE TABLE "recommendation_collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"collection_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_collections_server_user_unique" UNIQUE("server_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "recommendation_collections_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recommendation_collections" ADD CONSTRAINT "recommendation_collections_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;