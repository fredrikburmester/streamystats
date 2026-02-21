# Streamystats

Streamystats is a statistics service for Jellyfin, providing analytics and data visualization. 📈 Built with modern advanced frameworks.

> This is a personal hobby project, so please don't expect rapid development. Even though I am a full-time experienced developer, this project is prone to bugs, and **I am using** AI-assisted development for tasks ranging from PR reviews to refactoring and coding new features.

## Features

- Dashboard with overview statistics, live sessions, recommendations, and more
- User-specific watch history and statistics
- Library statistics
- Watch time graphs with advanced filtering
- Client statistics
- Multi-server and user support
- AI chat with your library and get watch recommendations
- Embedding supported watch recommendations
- Supported by Janitorr (beta)
- Import data from Jellystat and Playback Reporting Plugin to get started

### Embeddings

Library items are embedded using OpenAI-compatible APIs **if enabled**, supporting multiple models and custom configurations. Embeddings are stored in vectorchord with support for any dimension, allowing you to use any embedding model. The system automatically creates vector indexes optimized for similarity search.

### AI Chat

Interactive chat interface. Supports multiple providers out of the box with any OpenAI-compatible API.

The chat includes function calling with 13 specialized tools:

- Personalized recommendations based on watch history
- Semantic library search using embeddings
- Watch statistics and most-watched content
- Shared recommendations for multiple users
- Genre filtering and top-rated items
- Recently added content discovery

### AI Recommendations

Recommendations use vector similarity (cosine distance) to find content similar to your watch history. The system analyzes your viewing patterns and suggests movies and series. Each recommendation includes explanations showing which watched items led to the suggestion.

## Roadmap

- [x] Individual item statistics
- [x] More statistics
- [x] Only sync certain libraries
- [x] More AI tools for better chat

## Getting started

> Playback reporting plugin is no longer needed and Streamystats solely relies on the Jellyfin API for statistics.

### Docker

1. Install Docker and Docker Compose if you haven't already.
2. Copy the `docker-compose.yml` file to your desired location. Use tag `:latest` (read more below in [Version Tags](#version-tags).
3. Change any ports if needed. Default web port is `3000`.
4. Change the `SESSION_SECRET` in the `docker-compose.yml` file to a random string. You can generate one with `openssl rand -hex 64`.
5. Start the application with `docker-compose up -d`
6. Open your browser and navigate to `http://localhost:3000`
7. Follow the setup wizard to connect your Jellyfin server.

First time load can take a while, depending on the size of your library.

### Version Tags

Version tags (e.g., `v1.2.3`) are automatically generated on release. These tags provide stable, tested reference points for production use. I recommend pinning to specific version tags for stability.

The `:latest` tag always points to the latest commit on the main branch. It contains the most recent features and fixes. While typically stable, it may occasionally contain breaking changes

### Dockerless

Docker is currently the easiest and recommended way to run streamystats. However you can also run without docker.

[See the documentation](DOCKERLESS.md)

## Screenshots

<img width="1625" height="1083" alt="Screenshot 2025-12-23 at 11 46 07" src="https://github.com/user-attachments/assets/bcb5c90a-082e-40c2-b567-842ae6c61cf0" />
<img width="1625" height="1083" alt="Screenshot 2025-12-23 at 11 49 35" src="https://github.com/user-attachments/assets/3c3276ad-93b2-479b-a783-a1f1a7c9afb3" />
<img width="1625" height="1083" alt="Screenshot 2025-12-23 at 11 49 24" src="https://github.com/user-attachments/assets/37fd7b49-aba8-445a-9042-228aeb28b848" />
<img width="1625" height="1083" alt="Screenshot 2025-12-23 at 11 47 52" src="https://github.com/user-attachments/assets/0e554541-9aa6-4147-b998-2b7e99e0f797" />
<img width="1625" height="1083" alt="Screenshot 2025-12-23 at 11 47 44" src="https://github.com/user-attachments/assets/0c78b616-216b-4c94-8c6d-cd818d264f74" />
<img width="1625" height="1083" alt="Screenshot 2025-12-23 at 11 46 32" src="https://github.com/user-attachments/assets/5628c261-adb5-4e25-9dc9-97b12d161897" />
<img width="1625" height="1083" alt="Screenshot 2025-12-23 at 11 46 25" src="https://github.com/user-attachments/assets/79790df1-880a-47fb-8259-c22924343cb8" />

## Tech Stack

- Frontend: Next.js, React, TypeScript
- Backend: Hono with Bun v1.3
- Database: vectorchord (used for embeddings)
- Containerization: Docker
