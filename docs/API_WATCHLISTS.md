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

### GET /api/watchlists

List all watchlists for the authenticated user (own watchlists + public watchlists from other users).

#### Response

```json
{
  "data": [
    {
      "id": 1,
      "serverId": 4,
      "userId": "user-id",
      "name": "My Favorites",
      "description": "My favorite movies",
      "isPublic": false,
      "isPromoted": false,
      "allowedItemType": "Movie",
      "defaultSortOrder": "custom",
      "createdAt": "2025-12-27T18:33:00.006Z",
      "updatedAt": "2025-12-28T10:35:52.514Z",
      "itemCount": 5
    }
  ]
}
```

#### Example

```bash
curl "https://streamystats.example.com/api/watchlists" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

---

### POST /api/watchlists

Create a new watchlist.

#### Request Body

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | **Yes** | - | Watchlist name |
| `description` | string | No | null | Watchlist description |
| `isPublic` | boolean | No | false | Whether other users can view this watchlist |
| `allowedItemType` | string | No | null | Restrict items to type (e.g., "Movie", "Series") |
| `defaultSortOrder` | string | No | "custom" | Sort order: `custom`, `name`, `dateAdded`, `releaseDate` |

#### Response (201 Created)

```json
{
  "data": {
    "id": 5,
    "serverId": 4,
    "userId": "user-id",
    "name": "Action Movies",
    "description": "Best action films",
    "isPublic": false,
    "isPromoted": false,
    "allowedItemType": "Movie",
    "defaultSortOrder": "custom",
    "createdAt": "2025-12-28T12:00:00.000Z",
    "updatedAt": "2025-12-28T12:00:00.000Z"
  }
}
```

#### Example

```bash
curl -X POST "https://streamystats.example.com/api/watchlists" \
  -H 'Authorization: MediaBrowser Token="your-token"' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Action Movies",
    "description": "Best action films",
    "allowedItemType": "Movie"
  }'
```

---

### GET /api/watchlists/[id]

Get a single watchlist by ID with all its items.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | integer | **Yes** | - | Watchlist ID (in URL path) |
| `format` | string | No | `full` | Response format: `full` or `ids` |

#### Behavior

Returns watchlist if the authenticated user owns it or if it's public.

#### Response (Full Format)

```json
{
  "data": {
    "id": 2,
    "serverId": 4,
    "userId": "user-id",
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
  "data": {
    "id": 2,
    "name": "Favorite Love Movies",
    "items": ["abc123", "def456", "ghi789"]
  }
}
```

#### Example

```bash
# Full format
curl "https://streamystats.example.com/api/watchlists/2" \
  -H 'Authorization: MediaBrowser Token="your-token"'

# IDs only format
curl "https://streamystats.example.com/api/watchlists/2?format=ids" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

---

### PATCH /api/watchlists/[id]

Update a watchlist. Only the owner can update a watchlist.

#### Request Body

All fields are optional. Only provided fields will be updated.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Watchlist name (cannot be empty) |
| `description` | string | Watchlist description |
| `isPublic` | boolean | Whether other users can view this watchlist |
| `allowedItemType` | string | Restrict items to type (or null to allow all) |
| `defaultSortOrder` | string | Sort order: `custom`, `name`, `dateAdded`, `releaseDate` |
| `isPromoted` | boolean | **Admin only**: Show on all users' home screens |

#### Response

```json
{
  "data": {
    "id": 2,
    "name": "Updated Name",
    "description": "New description",
    ...
  }
}
```

#### Example

```bash
curl -X PATCH "https://streamystats.example.com/api/watchlists/2" \
  -H 'Authorization: MediaBrowser Token="your-token"' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Updated Name",
    "isPublic": true
  }'
```

---

### DELETE /api/watchlists/[id]

Delete a watchlist. Only the owner can delete a watchlist.

#### Response

```json
{
  "success": true
}
```

#### Example

```bash
curl -X DELETE "https://streamystats.example.com/api/watchlists/2" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

---

### GET /api/watchlists/[id]/items

Get all items in a watchlist with optional filtering.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | integer | **Yes** | - | Watchlist ID (in URL path) |
| `type` | string | No | - | Filter by item type (e.g., "Movie", "Series") |
| `sort` | string | No | - | Sort order: `custom`, `name`, `dateAdded`, `releaseDate` |

#### Response

```json
{
  "data": {
    "id": 2,
    "name": "Favorite Movies",
    ...
    "items": [
      {
        "id": 1,
        "watchlistId": 2,
        "itemId": "abc123",
        "position": 0,
        "addedAt": "2025-12-27T18:34:00.000Z",
        "item": { ... }
      }
    ]
  }
}
```

#### Example

```bash
curl "https://streamystats.example.com/api/watchlists/2/items?type=Movie" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

---

### POST /api/watchlists/[id]/items

Add an item to a watchlist. Only the owner can add items.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `itemId` | string | **Yes** | Jellyfin item ID to add |

#### Response (201 Created)

```json
{
  "data": {
    "id": 5,
    "watchlistId": 2,
    "itemId": "abc123",
    "position": 3,
    "addedAt": "2025-12-28T12:00:00.000Z"
  }
}
```

#### Errors

- Returns 400 if the watchlist has `allowedItemType` set and the item doesn't match
- Returns 400 if the item already exists in the watchlist

#### Example

```bash
curl -X POST "https://streamystats.example.com/api/watchlists/2/items" \
  -H 'Authorization: MediaBrowser Token="your-token"' \
  -H 'Content-Type: application/json' \
  -d '{"itemId": "abc123"}'
```

---

### DELETE /api/watchlists/[id]/items/[itemId]

Remove an item from a watchlist. Only the owner can remove items.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | **Yes** | Watchlist ID (in URL path) |
| `itemId` | string | **Yes** | Jellyfin item ID to remove (in URL path) |

#### Response

```json
{
  "success": true
}
```

#### Example

```bash
curl -X DELETE "https://streamystats.example.com/api/watchlists/2/items/abc123" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

---

### GET /api/watchlists/promoted

Get all promoted watchlists for a server. These are watchlists marked by admins to display on all users' home screens.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `format` | string | No | `full` | Response format: `full` or `ids` |
| `limit` | integer | No | 20 | Max results (1-100) |
| `includePreview` | boolean | No | true | Include preview items (first 4) |

**Server identification (use one):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | integer | Internal Streamystats server ID |
| `serverName` | string | Server name (exact match, case-insensitive) |
| `serverUrl` | string | Server URL (partial match) |
| `jellyfinServerId` | string | Jellyfin's unique server ID |

#### Response (Full Format)

```json
{
  "server": { "id": 4, "name": "Fredflix" },
  "data": [
    {
      "id": 2,
      "serverId": 4,
      "userId": "user-id",
      "name": "Must Watch Movies",
      "description": "Our top picks",
      "isPublic": true,
      "isPromoted": true,
      "allowedItemType": "Movie",
      "defaultSortOrder": "custom",
      "createdAt": "2025-12-27T18:33:00.006Z",
      "updatedAt": "2025-12-28T10:35:52.514Z",
      "itemCount": 25,
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

```json
{
  "error": "Name is required"
}
```

```json
{
  "error": "Failed to add item. Watchlist not found, item type not allowed, or item already exists."
}
```

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Valid authentication required. Use session cookie or Authorization: MediaBrowser Token=\"...\" header."
}
```

### 403 Forbidden

```json
{
  "error": "Only admins can set the isPromoted flag"
}
```

### 404 Not Found

```json
{
  "error": "Watchlist not found"
}
```

```json
{
  "error": "Watchlist not found or access denied"
}
```

---

## Changelog

| Version | Changes |
|---------|---------|
| 2.0 | Full CRUD support for external clients via MediaBrowser token authentication |
| 1.1 | GET /api/watchlists/[id] now includes items and supports MediaBrowser auth |
| 1.0 | Initial release with promoted watchlists endpoint |
