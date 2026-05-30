CREATE TABLE "user_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"server_id" integer NOT NULL,
	"embedding" vector NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"last_calculated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_embeddings_user_server_unique" UNIQUE("user_id","server_id")
);
--> statement-breakpoint
ALTER TABLE "user_embeddings" ADD CONSTRAINT "user_embeddings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_embeddings" ADD CONSTRAINT "user_embeddings_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_embeddings_server_id_idx" ON "user_embeddings" USING btree ("server_id");