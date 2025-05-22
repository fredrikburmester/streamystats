# Streamystats

Streamystats is a statistics service for Jellyfin, providing analytics and data visualization. 📈 Built with modern advanced frameworks.

> This is a hobby project of mine. Don't expect fast development.

## ⚠️ Important Note: Vector PG Version

This project now uses a Vector-enabled Postgres version (`pgvector/pgvector:pg16`). If you are having trouble getting Streamystats to work after this update, please open an issue and i'll help. I previously recommended a data backup and restore method but it's not bulletproof. 

## ✨ Features

- 🖥️ Dashboard with overview statistics, live sessions and more!
- 👤 User-specific watch history and statistics
- 🌟 Most popular item tracking
- 📚 Library statistics
- ⏱️ Watch time graphs with advanced filtering
- 🏠 Multi-server and user support
- 🔄 Full sync options of items, libraries and users from the settings page
- 🧹 Supported by Janitorr (beta)
- ⬇️ Import data from Jellystat and Playback Reporting Plugin to get started!

## Roadmap

- [ ] Only sync certain libraries
- [ ] Individual item statistics
- [ ] More statistics about unwatched items and maybe the possibility to remove old or unwatched items
- [ ] More granular sync options

## 🚀 Getting started

> Playback reporting plugin is no longer needed and Streamystats soely relies on the Jellyfin API for statistics.

### Docker

1. Install Docker and Docker Compose if you haven't already.
2. Copy the `docker-compose.yml` file to your desired location. Use tag `:edge` (read more below in [Version Tags](#version-tags).
3. Change any ports if needed. Default web port is `3000`.
4. Change the `SECRET_KEY_BASE` in the `docker-compose.yml` file to a random string. You can generate one with `openssl rand -hex 64`.
5. You can configure the timezone in the `docker-compose.yml` file by setting both `TZ` and `NEXT_PUBLIC_TIMEZONE` environment variables for the app service. This ensures correct time display in all charts and statistics.
6. Start the application with `docker-compose up -d`
7. Open your browser and navigate to `http://localhost:3000`
8. Follow the setup wizard to connect your Jellyfin server.

First time load can take a while, depending on the size of your library.

### Version Tags

Version tags (e.g., `v1.2.3`) are automatically generated on release. These tags provide stable, tested reference points for production use. I recommend pinning to specific version tags for stability.

The `:edge` tag always points to the latest commit on the main branch. It contains the most recent features and fixes. While typically stable, it may occasionally contain breaking changes

## 📸 Screenshots
<img width="1545" alt="Screenshot 2024-11-06 at 21 29 48" src="https://github.com/user-attachments/assets/78c5843a-7dc4-4485-bfeb-841725b133e7">
<img width="1545" alt="Screenshot 2024-11-06 at 21 30 01" src="https://github.com/user-attachments/assets/d2d4bf6d-85a0-4c6d-8e2b-19e876dc6579">
<img width="1545" alt="Screenshot 2024-11-06 at 21 30 07" src="https://github.com/user-attachments/assets/1da33d70-5c26-4ce8-a753-06b08a409d17">
<img width="1545" alt="Screenshot 2024-11-03 at 10 57 04" src="https://github.com/user-attachments/assets/3dbbc7b0-2f64-44de-9b0c-a524de1a660d">
<img width="1545" alt="Screenshot 2024-11-03 at 10 57 35" src="https://github.com/user-attachments/assets/9dac59d8-54eb-4474-bc21-caf782492c14">
<img width="356" alt="Screenshot 2024-11-03 at 10 57 43" src="https://github.com/user-attachments/assets/b5988b08-8ba6-4fca-99d2-8e221016fcc9">
<img width="357" alt="Screenshot 2024-11-03 at 10 57 46" src="https://github.com/user-attachments/assets/34db1a56-dc05-4c87-b0c7-290e23be6d8c">

## 🛠️ Tech Stack

- Frontend: Next.js, React, TypeScript
- Backend: Phoenix (Elixir)
- Database: PostgreSQL
- Containerization: Docker

