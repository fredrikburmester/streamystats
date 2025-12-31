# Watchlists API

API endpoints for managing and fetching watchlists.

## Authentication

All endpoints support two authentication methods:

### 1. Session Cookie (Web App)
Automatically included when logged into the Streamystats web app.

### 2. MediaBrowser Token (External Clients)

```
Authorization: MediaBrowser Token="<jellyfin-access-token>"
```

See [EXTERNAL_API_AUTH.md](./EXTERNAL_API_AUTH.md) for details on obtaining tokens.

---

## Endpoints

### GET /api/watchlists/[id]

Get a single watchlist by ID with all its items.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | integer | **Yes** | - | Watchlist ID (in URL path) |
| `format` | string | No | `full` | Response format: `full` or `ids` |

**For external clients (MediaBrowser auth), also provide one of:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serverId` | integer | No | Internal Streamystats server ID |
| `serverName` | string | No | Server name (exact match, case-insensitive) |
| `serverUrl` | string | No | Server URL (partial match) |
| `jellyfinServerId` | string | No | Jellyfin's unique server ID |

#### Behavior

- **Session auth**: Returns watchlist if user owns it or it's public
- **MediaBrowser auth**: Returns watchlist only if public or promoted

#### Response (Full Format)

```json
{
  "server": { "id": 4, "name": "Fredflix" },
  "data": {
    "id": 2,
    "serverId": 4,
    "userId": "54038209920f40b7911951b7a6e8b5b7",
    "name": "Favorite Love Movies",
    "description": null,
    "isPublic": true,
    "isPromoted": true,
    "allowedItemType": "Movie",
    "defaultSortOrder": "custom",
    "createdAt": "2025-12-27T18:33:00.006Z",
    "updatedAt": "2025-12-28T10:35:52.514Z",
    "items": [
      {
        "id": 1,
        "watchlistId": 2,
        "itemId": "abc123",
        "position": 0,
        "addedAt": "2025-12-27T18:34:00.000Z",
        "item": {
          "id": "abc123",
          "name": "The Notebook",
          "type": "Movie",
          "productionYear": 2004,
          "runtimeTicks": 72000000000,
          "genres": ["Romance", "Drama"],
          "primaryImageTag": "tag123",
          "communityRating": 7.8
        }
      }
    ]
  }
}
```

#### Response (IDs Format)

Returns only item IDs for integration with Jellyfin API.

```json
{
  "server": { "id": 4, "name": "Fredflix" },
  "data": {
    "id": 2,
    "name": "Favorite Love Movies",
    "items": ["abc123", "def456", "ghi789"]
  }
}
```

#### Example

```bash
# External client with MediaBrowser auth - full format
curl "https://streamystats.example.com/api/watchlists/2?serverId=4" \
  -H 'Authorization: MediaBrowser Token="your-token"'

# IDs only format
curl "https://streamystats.example.com/api/watchlists/2?serverId=4&format=ids" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

---

### GET /api/watchlists/promoted

Get all promoted watchlists for a server.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `format` | string | No | `full` | Response format: `full` or `ids` |
| `limit` | integer | No | 20 | Max results (1-100) |
| `includePreview` | boolean | No | true | Include preview items (first 4) |

**Server identification (use one):**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serverId` | integer | No | Internal Streamystats server ID |
| `serverName` | string | No | Server name (exact match, case-insensitive) |
| `serverUrl` | string | No | Server URL (partial match) |
| `jellyfinServerId` | string | No | Jellyfin's unique server ID |

#### Response (Full Format)

```json
{
  "server": { "id": 4, "name": "Fredflix" },
  "data": [
    {
      "id": 2,
      "serverId": 4,
      "userId": "54038209920f40b7911951b7a6e8b5b7",
      "name": "Favorite Love Movies",
      "description": null,
      "isPublic": true,
      "isPromoted": true,
      "allowedItemType": "Movie",
      "defaultSortOrder": "custom",
      "createdAt": "2025-12-27T18:33:00.006Z",
      "updatedAt": "2025-12-28T10:35:52.514Z",
      "itemCount": 3,
      "previewItems": [
        {
          "id": "abc123",
          "name": "The Notebook",
          "type": "Movie",
          "primaryImageTag": "tag123"
        }
      ]
    }
  ],
  "total": 1
}
```

#### Response (IDs Format)

```json
{
  "data": {
    "watchlists": ["2", "5", "8"],
    "total": 3
  }
}
```

#### Example

```bash
# Get promoted watchlists with preview items
curl "https://streamystats.example.com/api/watchlists/promoted?serverId=4" \
  -H 'Authorization: MediaBrowser Token="your-token"'

# Get just IDs
curl "https://streamystats.example.com/api/watchlists/promoted?serverId=4&format=ids" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

---

## Item Fields

Items returned in watchlists include these fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Jellyfin item ID |
| `name` | string | Item name |
| `type` | string | Item type (Movie, Series, Episode, etc.) |
| `productionYear` | integer | Year of release |
| `runtimeTicks` | integer | Runtime in ticks |
| `genres` | array | List of genres |
| `primaryImageTag` | string | Jellyfin image tag for caching |
| `seriesId` | string | Parent series ID (for episodes) |
| `seriesName` | string | Parent series name (for episodes) |
| `communityRating` | number | Community rating (0-10) |

### Constructing Image URLs

Use the item's `id` and `primaryImageTag` to construct Jellyfin image URLs:

```
{jellyfin-url}/Items/{id}/Images/Primary?tag={primaryImageTag}&quality=90&maxWidth=300
```

---

## Error Responses

### 400 Bad Request

```json
{
  "error": "Invalid watchlist ID"
}
```

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Valid Jellyfin token required. Use Authorization: MediaBrowser Token=\"...\" header."
}
```

### 404 Not Found

```json
{
  "error": "Watchlist not found"
}
```

---

## Changelog

| Version | Changes |
|---------|---------|
| 1.1 | GET /api/watchlists/[id] now includes items and supports MediaBrowser auth |
| 1.0 | Initial release with promoted watchlists endpoint |
