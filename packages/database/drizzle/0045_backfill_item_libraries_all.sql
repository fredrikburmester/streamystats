INSERT INTO item_libraries (item_id, library_id)
SELECT id, library_id FROM items
ON CONFLICT DO NOTHING;
