CREATE TABLE "jellyseerr_items" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"tmdb_id" integer NOT NULL,
	"title" text NOT NULL,
	"original_title" text,
	"overview" text,
	"release_date" date,
	"production_year" integer,
	"type" text NOT NULL,
	"community_rating" real,
	"popularity" real,
	"vote_count" integer,
	"poster_path" text,
	"backdrop_path" text,
	"original_language" text,
	"adult" boolean DEFAULT false,
	"genres" json,
	"source_type" text NOT NULL,
	"media_type" text NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"embedding" real[],
	"raw_data" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jellyseerr_items" ADD CONSTRAINT "jellyseerr_items_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;