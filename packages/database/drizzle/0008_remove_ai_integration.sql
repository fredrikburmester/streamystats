-- Migration: Remove AI Integration
-- This migration removes all AI-related fields and tables from the database
-- Generated manually to remove embedding functionality

-- Drop the vector index first (if it exists)
DROP INDEX IF EXISTS "items_embedding_idx";

-- Remove AI-related columns from servers table
ALTER TABLE "servers" DROP COLUMN IF EXISTS "open_ai_api_token";
ALTER TABLE "servers" DROP COLUMN IF EXISTS "auto_generate_embeddings";
ALTER TABLE "servers" DROP COLUMN IF EXISTS "ollama_api_token";
ALTER TABLE "servers" DROP COLUMN IF EXISTS "ollama_base_url";
ALTER TABLE "servers" DROP COLUMN IF EXISTS "ollama_model";
ALTER TABLE "servers" DROP COLUMN IF EXISTS "embedding_provider";

-- Remove AI-related columns from items table
ALTER TABLE "items" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "items" DROP COLUMN IF EXISTS "processed";

-- Drop the hidden_recommendations table entirely (if it exists)
DROP TABLE IF EXISTS "hidden_recommendations";

-- Clean up any embedding-related job results
DELETE FROM "job_results" WHERE "job_name" = 'generate-item-embeddings';

-- Note: pgvector extension is not removed as it might be used by other applications
-- If you want to remove it completely, you can manually run: DROP EXTENSION IF EXISTS vector;
