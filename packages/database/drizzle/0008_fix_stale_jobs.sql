-- Fix stale jobs that are stuck in processing status
-- This addresses the root cause: jobs were being found but never updated, causing infinite growth

-- Update all stale embedding jobs older than 10 minutes to failed status
UPDATE job_results
SET 
    status = 'failed',
    error = 'Job cleanup - exceeded maximum processing time (automated fix)',
    processing_time = 3600000,  -- Cap at 1 hour
    result = jsonb_set(
        COALESCE(result, '{}'::jsonb),
        '{cleanedAt}',
        to_jsonb(NOW()::text),
        true
    )
WHERE 
    job_name = 'generate-item-embeddings'
    AND status = 'processing'
    AND created_at < NOW() - INTERVAL '10 minutes';

