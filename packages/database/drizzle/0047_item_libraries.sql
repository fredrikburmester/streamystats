CREATE TABLE "item_libraries" (
	"server_id" integer NOT NULL,
	"item_id" text NOT NULL,
	"library_id" text NOT NULL,
	CONSTRAINT "item_libraries_server_id_item_id_library_id_pk" PRIMARY KEY("server_id","item_id","library_id")
);
--> statement-breakpoint
-- Start every item off with the library it is stored under. The other
-- libraries it is in are added by the next full sync.
INSERT INTO "item_libraries" ("server_id", "item_id", "library_id")
SELECT "server_id", "id", "library_id" FROM "items";
--> statement-breakpoint
ALTER TABLE "item_libraries" ADD CONSTRAINT "item_libraries_items_server_fk" FOREIGN KEY ("server_id","item_id") REFERENCES "public"."items"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_libraries" ADD CONSTRAINT "item_libraries_libraries_server_fk" FOREIGN KEY ("server_id","library_id") REFERENCES "public"."libraries"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_libraries_library_idx" ON "item_libraries" USING btree ("server_id","library_id");