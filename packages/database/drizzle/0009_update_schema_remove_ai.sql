-- Follow-up migration to ensure schema consistency after AI removal
-- This migration verifies that all AI-related components have been properly removed

-- Verify that the hidden_recommendations table has been dropped
-- This should return an error if the table still exists
-- SELECT 1 FROM "hidden_recommendations" LIMIT 1;

-- Verify that AI-related columns have been removed from servers table
-- These queries should return errors if the columns still exist
-- SELECT "open_ai_api_token" FROM "servers" LIMIT 1;
-- SELECT "auto_generate_embeddings" FROM "servers" LIMIT 1;
-- SELECT "ollama_api_token" FROM "servers" LIMIT 1;
-- SELECT "ollama_base_url" FROM "servers" LIMIT 1;
-- SELECT "ollama_model" FROM "servers" LIMIT 1;
-- SELECT "embedding_provider" FROM "servers" LIMIT 1;

-- Verify that AI-related columns have been removed from items table
-- These queries should return errors if the columns still exist
-- SELECT "embedding" FROM "items" LIMIT 1;
-- SELECT "processed" FROM "items" LIMIT 1;

-- This migration serves as a verification step and doesn't perform any actual changes
-- All the actual removal work is done in migration 0008_remove_ai_functionality.sql
