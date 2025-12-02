-- Migration to remove AI functionality
-- This migration removes all AI-related fields and tables from StreamyStats

-- Step 1: Drop the hidden_recommendations table
-- This table stores user preferences for hiding AI recommendations
DROP TABLE IF EXISTS "hidden_recommendations";

-- Step 2: Remove AI-related fields from servers table
-- These fields were used for AI embedding generation and recommendation services
ALTER TABLE "servers" DROP COLUMN IF EXISTS "open_ai_api_token";
ALTER TABLE "servers" DROP COLUMN IF EXISTS "auto_generate_embeddings";
ALTER TABLE "servers" DROP COLUMN IF EXISTS "ollama_api_token";
ALTER TABLE "servers" DROP COLUMN IF EXISTS "ollama_base_url";
ALTER TABLE "servers" DROP COLUMN IF EXISTS "ollama_model";
ALTER TABLE "servers" DROP COLUMN IF EXISTS "embedding_provider";

-- Step 3: Remove AI-related fields from items table
-- The embedding field stored vector embeddings for similarity calculations
-- The processed field tracked whether items had been processed for AI features
ALTER TABLE "items" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "items" DROP COLUMN IF EXISTS "processed";

-- Step 4: Drop the vector extension if it's no longer needed
-- WARNING: Only uncomment this if you're absolutely sure no other tables use vector types
-- This extension was used for storing and querying vector embeddings
-- DROP EXTENSION IF EXISTS vector;

-- Note: This migration removes all AI functionality including:
-- - Content-based recommendations using embeddings
-- - User preference tracking for hiding recommendations  
-- - AI provider configurations (OpenAI, Ollama)
-- - Automatic embedding generation capabilities
