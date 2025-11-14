import OpenAI from "openai";

// Initialize OpenAI client (optional)
const {
  OPENAI_API_KEY,
  OPENAI_BASE_URL = "https://api.openai.com/v1",
  EMBEDDING_MODEL = "text-embedding-3-small",
} = process.env;

export const openai = OPENAI_API_KEY
  ? new OpenAI({
      apiKey: OPENAI_API_KEY,
      baseURL: OPENAI_BASE_URL,
    })
  : null;

// Configuration constants
export const OPENAI_CONFIG = {
  BASE_URL: OPENAI_BASE_URL,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS: 1536,
  MAX_TEXT_LENGTH: 8000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second base delay
  RATE_LIMIT_DELAY: 500, // 0.5 second delay between requests
} as const;

// Timeout configurations
export const TIMEOUT_CONFIG = {
  DEFAULT: 30000, // 30 seconds
  ITEMS_SYNC: 60000, // 60 seconds for large item syncs
} as const;
