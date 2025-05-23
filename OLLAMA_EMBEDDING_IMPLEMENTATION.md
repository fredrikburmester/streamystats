# Ollama Embedding Implementation

This document describes the implementation of Ollama API as an alternative to OpenAI API for creating embeddings in StreamyStats.

## Overview

The implementation adds support for Ollama as an embedding provider alongside the existing OpenAI integration. Users can now choose between OpenAI and Ollama for generating embeddings for their Jellyfin items, providing more flexibility and potentially cost-effective alternatives.

## Backend Changes

### 1. Database Schema Updates

**New fields added to `servers` table:**
- `ollama_api_token` (VARCHAR, optional) - API token for Ollama (if authentication is required)
- `ollama_base_url` (VARCHAR, default: 'http://localhost:11434') - Base URL for Ollama API
- `ollama_model` (VARCHAR, default: 'nomic-embed-text') - Ollama model to use for embeddings
- `embedding_provider` (VARCHAR, default: 'openai') - Selected embedding provider ('openai' or 'ollama')

### 2. New Embedding Provider Architecture

**Enhanced Behavior Definition:**
- Updated `StreamystatServer.EmbeddingProvider` behavior to support both single and batch embeddings
- Added token/configuration parameter support

**New Ollama Provider:**
- `StreamystatServer.EmbeddingProvider.Ollama` - Complete Ollama API integration
- Supports configurable base URL, model, and optional authentication
- Implements controlled concurrency for batch processing (since Ollama doesn't have native batch support)
- Includes proper error handling and retry logic with exponential backoff
- Handles connection errors with helpful messages

**Updated OpenAI Provider:**
- Added `@impl` annotations for behavior compliance
- Maintained backward compatibility

### 3. Core Embedding System Updates

**Dynamic Provider Selection:**
- `StreamystatServer.Embeddings` module now supports runtime provider selection
- Automatically determines provider based on server configuration
- Maintains backward compatibility with existing OpenAI-only setups

**Updated Batch Processing:**
- `StreamystatServer.BatchEmbedder` now works with any configured provider
- Retrieves full server configuration to determine appropriate provider
- Updated validation logic to check for any valid embedding configuration

### 4. Controller Updates

**Enhanced Settings Management:**
- Updated `StreamystatServerWeb.ServerController` to handle all embedding-related fields
- Added validation for different provider configurations
- Automatically starts embedding process when valid configuration is provided

### 5. Worker Updates

**Auto-Embedder Worker:**
- Updated to check for any valid embedding configuration (OpenAI or Ollama)
- Supports mixed provider setups across different servers

**Sync Task Worker:**
- Updated to work with new provider-agnostic system

## Frontend Changes

### 1. Type Definitions

**Enhanced Server Type:**
```typescript
export type Server = {
  // ... existing fields
  ollama_api_token?: string;
  ollama_base_url?: string;
  ollama_model?: string;
  embedding_provider?: "openai" | "ollama";
};
```

### 2. API Functions

**New Ollama Configuration Functions:**
- `saveOllamaConfig()` - Save Ollama-specific configuration
- `saveEmbeddingProvider()` - Switch between providers

### 3. UI Components

**Enhanced EmbeddingsManager Component:**
- Provider selection dropdown (OpenAI/Ollama)
- Conditional rendering of configuration fields based on selected provider
- OpenAI configuration: API key input
- Ollama configuration: Base URL, model selection, optional API token
- Popular model suggestions for Ollama (nomic-embed-text, all-minilm, etc.)
- Provider-agnostic validation and controls
- Helpful instructions for Ollama model setup

## Usage Guide

### Setting up OpenAI (existing functionality)
1. Navigate to Server Settings > AI & Embeddings
2. Select "OpenAI" as the embedding provider
3. Enter your OpenAI API key
4. Save configuration

### Setting up Ollama (new functionality)
1. Install and run Ollama on your server  
   **Tested/recommended version:** Ollama v0.1.32 or later  
   _Using a tested version helps avoid compatibility issues. See [Ollama releases](https://github.com/ollama/ollama/releases) for details._
2. Pull an embedding model: `ollama pull nomic-embed-text`
3. Navigate to Server Settings > AI & Embeddings
4. Select "Ollama" as the embedding provider
5. Configure:
   - **Base URL**: URL where Ollama is running (default: http://localhost:11434)
   - **Model**: Select from popular embedding models
   - **API Token**: Optional, leave empty if Ollama doesn't require authentication
6. Save configuration

### Recommended Ollama Models

- **nomic-embed-text** (default) - Good balance of speed and quality
- **all-minilm** - Fast and lightweight
- **mxbai-embed-large** - High quality embeddings
- **bge-large/bge-base** - Good general-purpose options
- **snowflake-arctic-embed** - High-performance option

### Auto-Generation
Once configured with either provider, you can:
- Enable "Auto-Generate Embeddings" to automatically process new items
- Manually start/stop embedding processes
- Monitor progress in real-time

## Technical Notes

### Embedding Dimensions
- Both providers use 1536-dimensional embeddings for compatibility
- Existing embeddings remain valid when switching providers
- New embeddings will use the selected provider

### Performance Considerations
- Ollama: Processes embeddings individually with controlled concurrency (3 parallel requests)
- OpenAI: Uses native batch processing when available
- Both providers include retry logic and rate limiting

### Error Handling
- Clear error messages for common issues (connection refused, invalid API keys)
- Graceful fallback and recovery mechanisms
- Progress tracking with detailed status information

### Security
- API tokens are stored securely and transmitted over HTTPS
- Optional authentication for Ollama (not required for local installations)
- Provider selection is server-specific

## Migration Notes

- **Fully backward compatible** - existing OpenAI setups continue to work unchanged
- **No data migration required** - existing embeddings are preserved
- **Gradual adoption** - can set up different providers for different servers
- **Default behavior unchanged** - new servers default to OpenAI provider

## Dependencies

### Backend
- No new dependencies required
- Uses existing HTTPoison for HTTP requests
- Leverages existing Pgvector integration

### Frontend
- Uses existing UI components from the design system
- No new external dependencies

## Testing

The implementation has been tested for:
- ✅ Compilation (both backend and frontend)
- ✅ TypeScript type checking
- ✅ Database schema updates
- ✅ UI component rendering
- ✅ Backward compatibility

For runtime testing, ensure:
1. Ollama is installed and running
2. Required embedding models are pulled
3. Network connectivity between StreamyStats and Ollama

## Future Enhancements

Potential future improvements:
- Support for additional embedding providers (Sentence Transformers, etc.)
- Model-specific dimension configuration
- Performance benchmarking between providers
- Embedding quality comparison tools
- Bulk provider migration utilities 