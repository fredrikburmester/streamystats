ALTER TABLE "item_people" DROP CONSTRAINT "item_people_unique";--> statement-breakpoint
ALTER TABLE "hidden_recommendations" DROP CONSTRAINT "hidden_recommendations_item_id_items_id_fk";
--> statement-breakpoint
ALTER TABLE "item_people" DROP CONSTRAINT "item_people_item_id_items_id_fk";
--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_library_id_libraries_id_fk";
--> statement-breakpoint
ALTER TABLE "media_sources" DROP CONSTRAINT "media_sources_item_id_items_id_fk";
--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_item_id_items_id_fk";
--> statement-breakpoint
ALTER TABLE "watchlist_items" DROP CONSTRAINT "watchlist_items_watchlist_id_watchlists_id_fk";
--> statement-breakpoint
ALTER TABLE "watchlist_items" DROP CONSTRAINT "watchlist_items_item_id_items_id_fk";
--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_pkey";--> statement-breakpoint
ALTER TABLE "libraries" DROP CONSTRAINT "libraries_pkey";--> statement-breakpoint
ALTER TABLE "media_sources" DROP CONSTRAINT "media_sources_pkey";--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_server_id_id_pk" PRIMARY KEY("server_id","id");--> statement-breakpoint
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_server_id_id_pk" PRIMARY KEY("server_id","id");--> statement-breakpoint
ALTER TABLE "media_sources" ADD CONSTRAINT "media_sources_server_id_id_pk" PRIMARY KEY("server_id","id");--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "server_id" integer;--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_server_id_id_unique" UNIQUE("server_id","id");
--> statement-breakpoint
-- Keep historical links when an earlier collision moved the referenced row to
-- another server. Copies retain the available metadata until the next full sync;
-- clearing etag and derived data forces those copies to be fetched again.
UPDATE watchlist_items wi SET server_id = w.server_id
FROM watchlists w WHERE w.id = wi.watchlist_id;
--> statement-breakpoint
ALTER TABLE watchlist_items ALTER COLUMN server_id SET NOT NULL;
--> statement-breakpoint
CREATE TEMP TABLE media_identity_recovery ON COMMIT DROP AS
SELECT DISTINCT refs.server_id, refs.item_id, i.library_id
FROM (
  SELECT server_id, item_id FROM sessions WHERE item_id IS NOT NULL
  UNION SELECT server_id, item_id FROM hidden_recommendations
  UNION SELECT server_id, item_id FROM item_people
  UNION SELECT server_id, item_id FROM media_sources
  UNION SELECT server_id, item_id FROM watchlist_items
) refs
JOIN items i ON i.id = refs.item_id
WHERE NOT EXISTS (
  SELECT 1 FROM items owned WHERE owned.server_id = refs.server_id AND owned.id = refs.item_id
);
--> statement-breakpoint
INSERT INTO libraries (server_id, id, name, type, created_at, updated_at)
SELECT DISTINCT refs.server_id, l.id, l.name, l.type, l.created_at, l.updated_at
FROM (
  SELECT server_id, library_id FROM items
  UNION SELECT server_id, library_id FROM media_identity_recovery
) refs
JOIN libraries l ON l.id = refs.library_id
WHERE NOT EXISTS (
  SELECT 1 FROM libraries owned WHERE owned.server_id = refs.server_id AND owned.id = refs.library_id
)
ON CONFLICT (server_id, id) DO NOTHING;
--> statement-breakpoint
INSERT INTO items
SELECT (jsonb_populate_record(NULL::items, to_jsonb(i) || jsonb_build_object(
  'server_id', refs.server_id,
  'etag', NULL,
  'embedding', NULL,
  'processed', false,
  'people_synced', false,
  'media_sources_synced', false
))).*
FROM media_identity_recovery refs
JOIN items i ON i.id = refs.item_id
ON CONFLICT (server_id, id) DO NOTHING;
--> statement-breakpoint
ALTER TABLE "hidden_recommendations" ADD CONSTRAINT "hidden_recommendations_items_server_fk" FOREIGN KEY ("server_id","item_id") REFERENCES "public"."items"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_people" ADD CONSTRAINT "item_people_items_server_fk" FOREIGN KEY ("server_id","item_id") REFERENCES "public"."items"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_libraries_server_fk" FOREIGN KEY ("server_id","library_id") REFERENCES "public"."libraries"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_sources" ADD CONSTRAINT "media_sources_items_server_fk" FOREIGN KEY ("server_id","item_id") REFERENCES "public"."items"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_items_server_fk" FOREIGN KEY ("server_id","item_id") REFERENCES "public"."items"("server_id","id") ON DELETE SET NULL ("item_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_watchlist_server_fk" FOREIGN KEY ("server_id","watchlist_id") REFERENCES "public"."watchlists"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_items_server_fk" FOREIGN KEY ("server_id","item_id") REFERENCES "public"."items"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_people" ADD CONSTRAINT "item_people_unique" UNIQUE("server_id","item_id","person_id","type");--> statement-breakpoint
