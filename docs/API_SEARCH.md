# Search API

Global search endpoint for finding media, people, users, watchlists, and more.

## Endpoint

```
GET /api/search
```

## Authentication

Supports two authentication methods:

### 1. Session Cookie (Web App)
Automatically included when logged into the Streamystats web app.

### 2. MediaBrowser Token (External Clients)

```
Authorization: MediaBrowser Token="<jellyfin-access-token>"
```

See [EXTERNAL_API_AUTH.md](./EXTERNAL_API_AUTH.md) for details on obtaining tokens.

---

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | **Yes** | - | Search query |
| `limit` | integer | No | 10 | Max results per category (1-100) |
| `format` | string | No | `full` | Response format: `full` or `ids` |
| `type` | string | No | `all` | Filter by content type |

### Type Filter Values

| Value | Description |
|-------|-------------|
| `all` | All content types (default) |
| `media` | All media items (movies, series, episodes, audio) |
| `movies` | Movies only |
| `series` | TV series only |
| `episodes` | Episodes only |
| `audio` | Audio/music content |
| `people` | All people (actors, directors, writers) |
| `actors` | Actors only |
| `directors` | Directors only |
| `writers` | Writers only |
| `users` | Jellyfin users |
| `watchlists` | User watchlists |
| `activities` | Server activities |
| `sessions` | Playback history/sessions |

---

## Response Formats

### Full Format (default)

Returns complete search results with metadata, grouped by category.

**Request:**
```
GET /api/search?q=matrix&format=full
```

**Response:**
```json
{
  "data": {
    "items": [
      {
        "id": "abc123",
        "type": "item",
        "subtype": "Movie",
        "title": "The Matrix",
        "subtitle": "1999",
        "imageId": "abc123",
        "imageTag": "tag123",
        "href": "/library/abc123",
        "rank": 0.95
      }
    ],
    "users": [
      {
        "id": "user123",
        "type": "user",
        "title": "Neo",
        "subtitle": "Administrator",
        "href": "/users/user123"
      }
    ],
    "watchlists": [],
    "activities": [],
    "sessions": [],
    "actors": [
      {
        "id": "actor123",
        "type": "actor",
        "subtype": "Actor",
        "title": "Keanu Reeves",
        "subtitle": "Actor",
        "imageId": "actor123",
        "imageTag": "actortag",
        "href": "/actors/actor123"
      }
    ],
    "total": 2
  }
}
```

### IDs Format

Returns only Jellyfin IDs, categorized by content type. Useful for integration with Jellyfin API.

**Request:**
```
GET /api/search?q=matrix&format=ids
```

**Response:**
```json
{
  "data": {
    "movies": ["abc123", "def456"],
    "series": ["ghi789"],
    "episodes": [],
    "seasons": [],
    "audio": [],
    "actors": ["actor123"],
    "directors": ["director456"],
    "writers": [],
    "total": 4
  }
}
```

---

## Examples

### Basic Search

```bash
curl "https://streamystats.example.com/api/search?q=breaking%20bad" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

### Search Movies Only

```bash
curl "https://streamystats.example.com/api/search?q=action&type=movies&limit=20" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

### Search Actors Only

```bash
curl "https://streamystats.example.com/api/search?q=keanu&type=actors" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

### Get IDs for Jellyfin API

```bash
curl "https://streamystats.example.com/api/search?q=star%20wars&format=ids&limit=50" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

### Combine Type Filter with IDs Format

```bash
curl "https://streamystats.example.com/api/search?q=sci-fi&type=series&format=ids" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

---

## Response Fields

### SearchResult Object (Full Format)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (Jellyfin ID for items/actors) |
| `type` | string | Result type: `item`, `user`, `watchlist`, `activity`, `session`, `actor` |
| `subtype` | string | Content subtype (e.g., `Movie`, `Series`, `Actor`, `Director`) |
| `title` | string | Display name |
| `subtitle` | string | Secondary text (year, role, etc.) |
| `imageId` | string | Jellyfin item ID for image |
| `imageTag` | string | Jellyfin image tag for caching |
| `href` | string | Relative URL path in Streamystats |
| `rank` | number | Search relevance score (0-1) |
| `metadata` | object | Additional type-specific metadata |

### Using Image Fields

Construct Jellyfin image URLs using `imageId` and `imageTag`:

```
{jellyfin-url}/Items/{imageId}/Images/Primary?tag={imageTag}&quality=90&maxWidth=200
```

---

## Error Responses

### 400 Bad Request - Missing Query

```json
{
  "error": "Search query is required",
  "data": {
    "movies": [],
    "series": [],
    ...
    "total": 0
  }
}
```

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Valid authentication required. Use session cookie or Authorization: MediaBrowser Token=\"...\" header."
}
```

---

## Rate Limiting

No rate limiting is currently enforced, but please be respectful with request frequency.

---

## Changelog

| Version | Changes |
|---------|---------|
| 1.0 | Initial release with full/ids formats, type filtering, MediaBrowser auth |
