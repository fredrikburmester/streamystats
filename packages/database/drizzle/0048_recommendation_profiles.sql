CREATE TABLE "user_recommendation_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"likes_text" text DEFAULT '' NOT NULL,
	"dislikes_text" text DEFAULT '' NOT NULL,
	"like_themes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dislike_themes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"use_watch_history" boolean DEFAULT true NOT NULL,
	"exclude_started" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_recommendation_profiles_server_user_unique" UNIQUE("server_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "user_recommendation_profiles" ADD CONSTRAINT "user_recommendation_profiles_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;