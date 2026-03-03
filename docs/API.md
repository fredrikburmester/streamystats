# External API

Streamystats exposes a REST API that external clients (mobile apps, scripts, third-party integrations) can use to search media, get personalized recommendations, and manage watchlists. All endpoints live under `/api/`.

## Authentication

All API endpoints require authentication. Two methods are supported:

### Session Cookie (Web App)

Automatically included when logged into the Streamystats web app. No additional headers needed.

### MediaBrowser Token (External Clients)

Use the `Authorization` header with the MediaBrowser format:

```
Authorization: MediaBrowser Token="<access-token>"
```

The full header can include optional parameters:

```
Authorization: MediaBrowser Client="MyApp", Device="iPhone", DeviceId="abc123", Version="1.0.0", Token="<access-token>"
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `Token` | **Yes** | Jellyfin access token from `AuthenticationResult.AccessToken` |
| `Client` | No | Client application name |
| `Device` | No | Device name |
| `DeviceId` | No | Unique device identifier |
| `Version` | No | Client version |

### Obtaining a Token

Authenticate with Jellyfin's `/Users/AuthenticateByName` endpoint:

```bash
curl -X POST "https://your-jellyfin-server/Users/AuthenticateByName" \
  -H "Content-Type: application/json" \
  -d '{"Username": "your-username", "Pw": "your-password"}'
```

The response contains an `AccessToken`:

```json
{
  "AccessToken": "abc123...",
  "User": { "Id": "user-id", "Name": "username" },
  "SessionInfo": { ... },
  "ServerId": "server-id"
}
```

Use that `AccessToken` value in the `Token` parameter.

### Security Notes

- Tokens are validated against the Jellyfin server on each request
- Use HTTPS in production
- Tokens inherit the permissions of the Jellyfin user
- Session tokens can be revoked from Jellyfin's device management

---

## Server Identification

Several endpoints require identifying which Jellyfin server to query. Use one of:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `serverId` | Internal Streamystats server ID | `?serverId=1` |
| `serverName` | Server name (exact match, case-insensitive) | `?serverName=MyServer` |
| `serverUrl` | Server URL (partial match) | `?serverUrl=jellyfin.example.com` |
| `jellyfinServerId` | Jellyfin's unique server ID (from `/System/Info`) | `?jellyfinServerId=abc123...` |

---

## Search

### GET /api/search

Global search across media, people, users, watchlists, and more.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | **Yes** | - | Search query |
| `limit` | integer | No | 10 | Max results per category (1-100) |
| `format` | string | No | `full` | Response format: `full` or `ids` |
| `type` | string | No | `all` | Filter by content type |

#### Type Filter Values

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

#### Response: Full Format (default)

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
    "watchlists": [
      {
        "id": "42",
        "type": "watchlist",
        "title": "Matrix Marathon",
        "subtitle": "All Matrix films in order",
        "href": "/watchlists/42",
        "metadata": { "owner": "You" },
        "rank": 0.75
      }
    ],
    "activities": [
      {
        "id": "act-001",
        "type": "activity",
        "subtype": "VideoPlayback",
        "title": "Neo played The Matrix",
        "subtitle": "VideoPlayback",
        "href": "/activities?search=Neo%20played%20The%20Matrix",
        "metadata": {
          "severity": "Information",
          "date": "2025-07-23T07:51:42.811836Z"
        },
        "rank": 0.60
      }
    ],
    "sessions": [
      {
        "id": "sess-789",
        "type": "session",
        "title": "The Matrix",
        "subtitle": "Neo - Jellyfin Web",
        "href": "/history?search=The%20Matrix",
        "metadata": { "date": "2025-07-22T20:15:00.000000Z" }
      }
    ],
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
    "total": 5
  }
}
```

#### Response: IDs Format

Returns only Jellyfin IDs, categorized by content type. Useful for integration with the Jellyfin API.

```
GET /api/search?q=matrix&format=ids
```

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

#### SearchResult Fields

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
| `metadata` | object | Additional type-specific metadata (see below) |

#### Metadata by Result Type

The `metadata` field carries extra context that varies per result type. It is omitted when there is nothing to report.

| Result type | Field | Type | Description |
|-------------|-------|------|-------------|
| `watchlist` | `owner` | string | `"You"` when the authenticated user owns the watchlist; omitted otherwise |
| `activity` | `severity` | string | Jellyfin severity level (e.g., `"Information"`, `"Warning"`, `"Error"`) |
| `activity` | `date` | string | ISO 8601 UTC timestamp of the activity |
| `session` | `date` | string | ISO 8601 UTC timestamp of when playback started (empty string if unknown) |
| `item` | -- | -- | No metadata returned |
| `user` | -- | -- | No metadata returned |
| `actor` | -- | -- | No metadata returned |

#### Examples

```bash
# Basic search
curl "https://streamystats.example.com/api/search?q=breaking%20bad" \
  -H 'Authorization: MediaBrowser Token="your-token"'

# Movies only
curl "https://streamystats.example.com/api/search?q=action&type=movies&limit=20" \
  -H 'Authorization: MediaBrowser Token="your-token"'

# Actors only
curl "https://streamystats.example.com/api/search?q=keanu&type=actors" \
  -H 'Authorization: MediaBrowser Token="your-token"'

# IDs format for Jellyfin API integration
curl "https://streamystats.example.com/api/search?q=star%20wars&format=ids&limit=50" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

#### Errors

| Status | Response |
|--------|----------|
| 400 | `{"error": "Search query is required", "data": {"movies": [], ...}}` |
| 401 | `{"error": "Unauthorized", "message": "Valid authentication required..."}` |

---

## Recommendations

### GET /api/recommendations

Get personalized recommendations for the authenticated user.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `serverId` | | **Yes** | - | Server identifier (see [Server Identification](#server-identification)) |
| `limit` | integer | No | 20 | Max results (1-100) |
| `type` | string | No | `all` | Filter: `Movie`, `Series`, or `all` |
| `range` | string | No | `all` | Time range: `7d`, `30d`, `90d`, `thisMonth`, `all` |
| `format` | string | No | `full` | Response format: `full` or `ids` |
| `includeBasedOn` | boolean | No | true | Include source items |
| `includeReasons` | boolean | No | true | Include recommendation reasons |
| `targetUserId` | string | No | - | Admin only: get recommendations for another user |

#### Response: Full Format (default)

```json
{
  "server": { "id": 1, "name": "MyServer" },
  "user": { "id": "user-id", "name": "username" },
  "params": { ... },
  "data": [
    {
      "item": { "id": "jellyfin-id", "name": "Movie Name", "type": "Movie" },
      "similarity": 0.85,
      "basedOn": [{ "id": "...", "name": "Similar Movie" }],
      "reason": "Because you watched \"Similar Movie\" (shared: Action, Sci-Fi)"
    }
  ]
}
```

#### Response: IDs Format

```json
{
  "data": {
    "movies": ["jellyfin-id-1", "jellyfin-id-2"],
    "series": ["jellyfin-id-3"],
    "total": 3
  }
}
```

### POST /api/recommendations

Authenticate with Jellyfin credentials directly, removing the need to obtain a token separately. Query parameters are the same as the GET method.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | **Yes** | Jellyfin username |
| `password` | string | **Yes** | Jellyfin password |

#### Example

```bash
curl -X POST "https://streamystats.example.com/api/recommendations?serverId=1&limit=10&type=Movie" \
  -H "Content-Type: application/json" \
  -d '{"username": "your-username", "password": "your-password"}'
```

The credentials are validated against the Jellyfin server identified by the server query parameter. On success the response format is identical to the GET endpoint. On failure a `401` is returned.

---

## Watchlists

### GET /api/watchlists

List all watchlists for the authenticated user (own + public watchlists from other users).

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

Get a single watchlist by ID with all its items. Returns the watchlist if the authenticated user owns it or if it is public.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | integer | **Yes** | - | Watchlist ID (in URL path) |
| `format` | string | No | `full` | Response format: `full` or `ids` |

#### Response: Full Format

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

#### Response: IDs Format

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

# IDs only
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
| `isPromoted` | boolean | **Admin only**: show on all users' home screens |

#### Example

```bash
curl -X PATCH "https://streamystats.example.com/api/watchlists/2" \
  -H 'Authorization: MediaBrowser Token="your-token"' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Updated Name", "isPublic": true}'
```

---

### DELETE /api/watchlists/[id]

Delete a watchlist. Only the owner can delete a watchlist.

#### Example

```bash
curl -X DELETE "https://streamystats.example.com/api/watchlists/2" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

Returns `{"success": true}` on success.

---

### GET /api/watchlists/[id]/items

Get all items in a watchlist with optional filtering. Accepts both session cookie and MediaBrowser token authentication.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | integer | **Yes** | - | Watchlist ID (in URL path) |
| `type` | string | No | - | Filter by item type (e.g., "Movie", "Series") |
| `sort` | string | No | - | Sort order: `custom`, `name`, `dateAdded`, `releaseDate` |

#### Example

```bash
curl "https://streamystats.example.com/api/watchlists/2/items?type=Movie" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

---

### POST /api/watchlists/[id]/items

Add an item to a watchlist. Only the owner can add items. Accepts both session cookie and MediaBrowser token authentication.

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

Returns 400 if the watchlist has `allowedItemType` set and the item doesn't match, or if the item already exists in the watchlist.

#### Example

```bash
curl -X POST "https://streamystats.example.com/api/watchlists/2/items" \
  -H 'Authorization: MediaBrowser Token="your-token"' \
  -H 'Content-Type: application/json' \
  -d '{"itemId": "abc123"}'
```

---

### DELETE /api/watchlists/[id]/items/[itemId]

Remove an item from a watchlist. Only the owner can remove items. Accepts both session cookie and MediaBrowser token authentication.

#### Example

```bash
curl -X DELETE "https://streamystats.example.com/api/watchlists/2/items/abc123" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

Returns `{"success": true}` on success.

---

### GET /api/watchlists/promoted

Get promoted watchlists for a server. These are watchlists marked by admins to display on all users' home screens.

> **Auth:** This endpoint uses MediaBrowser token authentication.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `format` | string | No | `full` | Response format: `full` or `ids` |
| `limit` | integer | No | 20 | Max results (1-100) |
| `includePreview` | boolean | No | true | Include preview items (first 4) |

A server identifier is also required (see [Server Identification](#server-identification)).

#### Response: Full Format

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

#### Response: IDs Format

```json
{
  "data": {
    "watchlists": ["2", "5", "8"],
    "total": 3
  }
}
```

#### Setting Promoted Status (Admin Only)

Use `PATCH /api/watchlists/[id]` with `{"isPromoted": true}` and an admin token.

#### Example

```bash
curl "https://streamystats.example.com/api/watchlists/promoted?serverId=4" \
  -H 'Authorization: MediaBrowser Token="your-token"'
```

---

## Session-Only Watchlist Endpoints

These endpoints are only available to users logged into the Streamystats web app (session cookie auth). They do **not** accept MediaBrowser token authentication.

### GET /api/watchlists/by-name

Look up a watchlist by user ID and name.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | **Yes** | Jellyfin user ID |
| `name` | string | **Yes** | Watchlist name (exact match) |

Returns 400 if `userId` or `name` is missing. Returns 404 if no matching watchlist is found.

### POST /api/watchlists/[id]/items/reorder

Reorder items within a watchlist. Only the owner can reorder items.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `itemIds` | string[] | **Yes** | Ordered array of Jellyfin item IDs representing the new order |

Returns `{"success": true}` on success. Returns 400 if `itemIds` is missing or not an array of strings.

---

## Watchlist Item Fields

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

---

## Constructing Image URLs

For search results, use `imageId` and `imageTag`:

```
{jellyfin-url}/Items/{imageId}/Images/Primary?tag={imageTag}&quality=90&maxWidth=200
```

For watchlist items, use `id` and `primaryImageTag`:

```
{jellyfin-url}/Items/{id}/Images/Primary?tag={primaryImageTag}&quality=90&maxWidth=300
```

---

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Missing or invalid required parameters |
| 401 | Invalid or missing token |
| 403 | Insufficient permissions (e.g., non-admin setting `isPromoted`) |
| 404 | Resource not found or access denied |

```json
{
  "error": "Unauthorized",
  "message": "Valid Jellyfin token required. Use Authorization: MediaBrowser Token=\"...\" header."
}
```

---

## Rate Limiting

No rate limiting is currently enforced, but please be respectful with request frequency.
