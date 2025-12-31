# External API Authentication

Streamystats API endpoints support authentication via Jellyfin session tokens, allowing external clients (mobile apps, scripts, third-party integrations) to access the API.

## Authentication Method

Use the `Authorization` header with the MediaBrowser format:

```
Authorization: MediaBrowser Token="<access-token>"
```

### Full Header Format

The complete MediaBrowser authorization header can include additional parameters:

```
Authorization: MediaBrowser Client="MyApp", Device="iPhone", DeviceId="abc123", Version="1.0.0", Token="<access-token>"
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `Token` | **Yes** | The Jellyfin access token from `AuthenticationResult.AccessToken` |
| `Client` | No | Your client application name |
| `Device` | No | Device name |
| `DeviceId` | No | Unique device identifier |
| `Version` | No | Client version |

## Obtaining a Token

When authenticating with Jellyfin, the `/Users/AuthenticateByName` endpoint returns an `AuthenticationResult`:

```json
{
  "AccessToken": "abc123...",
  "User": {
    "Id": "user-id",
    "Name": "username",
    ...
  },
  "SessionInfo": { ... },
  "ServerId": "server-id"
}
```

Use the `AccessToken` value in the `Token` parameter.

## Example: Authenticate and Search

### Step 1: Get Token from Jellyfin

```bash
curl -X POST "https://your-jellyfin-server/Users/AuthenticateByName" \
  -H "Content-Type: application/json" \
  -H "X-Emby-Authorization: MediaBrowser Client=\"curl\", Device=\"CLI\", DeviceId=\"test\", Version=\"1.0\"" \
  -d '{"Username": "your-username", "Pw": "your-password"}'
```

### Step 2: Use Token with Streamystats API

```bash
curl "https://your-streamystats/api/search?q=matrix" \
  -H "Authorization: MediaBrowser Token=\"<access-token-from-step-1>\""
```

## Supported Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search` | GET | Global search across media, people, users |
| `/api/recommendations` | GET | Get personalized recommendations for authenticated user |
| `/api/watchlists/promoted` | GET | Get promoted watchlists for display on home screens |
| `/api/watchlists/[id]` | GET | Get a single watchlist by ID |
| `/api/watchlists/[id]` | PATCH | Update a watchlist (admin-only: isPromoted flag) |
| `/api/watchlists/[id]` | DELETE | Delete a watchlist |

*More endpoints will be added as they are updated to support external authentication.*

## Query Parameters for Search

| Parameter | Description | Example |
|-----------|-------------|---------|
| `q` | Search query (required) | `?q=matrix` |
| `limit` | Max results per category (1-100, default: 10) | `?limit=20` |
| `type` | Filter by type | `?type=movies` |
| `format` | Response format: `full` or `ids` | `?format=ids` |

### Type Filters

- `all` - All types (default)
- `media` - All media items
- `movies` - Movies only
- `series` - TV series only
- `episodes` - Episodes only
- `audio` - Audio/music
- `people` - All people (actors, directors, writers)
- `actors` - Actors only
- `directors` - Directors only
- `writers` - Writers only

### Response Formats

**Full format** (default):
```json
{
  "data": {
    "items": [{ "id": "...", "title": "The Matrix", ... }],
    "actors": [{ "id": "...", "title": "Keanu Reeves", ... }],
    ...
  }
}
```

**IDs format** (`?format=ids`):
```json
{
  "data": {
    "movies": ["id1", "id2"],
    "series": ["id3"],
    "actors": ["actor-id1"],
    ...
  }
}
```

The IDs format returns Jellyfin item IDs that can be used directly with the Jellyfin API.

## Server Identification

All endpoints that require a server accept multiple identification methods. Use one of:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `serverId` | Internal Streamystats server ID | `?serverId=1` |
| `serverName` | Server name (exact match, case-insensitive) | `?serverName=MyServer` |
| `serverUrl` | Server URL (partial match) | `?serverUrl=jellyfin.example.com` |
| `jellyfinServerId` | Jellyfin's unique server ID (from `/System/Info`) | `?jellyfinServerId=abc123...` |

## Query Parameters for Recommendations

| Parameter | Description | Example |
|-----------|-------------|---------|
| `serverId` | Server identifier (see above) | `?serverId=1` |
| `limit` | Max results (1-100, default: 20) | `?limit=10` |
| `type` | Filter by type: `Movie`, `Series`, or `all` | `?type=Movie` |
| `range` | Time range preset: `7d`, `30d`, `90d`, `thisMonth`, `all` | `?range=30d` |
| `format` | Response format: `full` or `ids` | `?format=ids` |
| `includeBasedOn` | Include source items (default: true) | `?includeBasedOn=false` |
| `includeReasons` | Include recommendation reasons (default: true) | `?includeReasons=false` |
| `targetUserId` | Admin only: get recommendations for another user | `?targetUserId=abc123` |

### Response Formats for Recommendations

**Full format** (default):
```json
{
  "server": { "id": 1, "name": "MyServer" },
  "user": { "id": "user-id", "name": "username" },
  "params": { ... },
  "data": [
    {
      "item": { "id": "jellyfin-id", "name": "Movie Name", "type": "Movie", ... },
      "similarity": 0.85,
      "basedOn": [{ "id": "...", "name": "Similar Movie", ... }],
      "reason": "Because you watched \"Similar Movie\" (shared: Action, Sci-Fi)"
    }
  ]
}
```

**IDs format** (`?format=ids`):
```json
{
  "data": {
    "movies": ["jellyfin-id-1", "jellyfin-id-2"],
    "series": ["jellyfin-id-3"],
    "total": 3
  }
}
```

## Query Parameters for Promoted Watchlists

| Parameter | Description | Example |
|-----------|-------------|---------|
| `serverId` | Server identifier (see Server Identification) | `?serverId=1` |
| `limit` | Max results (1-100, default: 20) | `?limit=10` |
| `format` | Response format: `full` or `ids` | `?format=ids` |
| `includePreview` | Include preview items (default: true) | `?includePreview=false` |

### Response Formats for Promoted Watchlists

**Full format** (default):
```json
{
  "server": { "id": 1, "name": "MyServer" },
  "data": [
    {
      "id": 1,
      "name": "Must Watch Movies",
      "description": "Our top picks",
      "isPublic": true,
      "isPromoted": true,
      "itemCount": 25,
      "previewItems": [
        { "id": "jellyfin-id", "name": "Movie Name", "type": "Movie", "primaryImageTag": "..." }
      ]
    }
  ],
  "total": 1
}
```

**IDs format** (`?format=ids`):
```json
{
  "data": {
    "watchlists": ["1", "2", "3"],
    "total": 3
  }
}
```

### Setting Promoted Status (Admin Only)

Admins can mark a watchlist as promoted via PATCH:

```bash
curl -X PATCH "https://your-streamystats/api/watchlists/123" \
  -H "Authorization: MediaBrowser Token=\"<admin-token>\"" \
  -H "Content-Type: application/json" \
  -d '{"isPromoted": true}'
```

## Error Responses

| Status | Description |
|--------|-------------|
| 401 | Invalid or missing token |
| 400 | Missing required parameters |

```json
{
  "error": "Unauthorized",
  "message": "Valid Jellyfin token required. Use Authorization: MediaBrowser Token=\"...\" header."
}
```

## Security Notes

- Tokens are validated against the Jellyfin server on each request
- Use HTTPS in production
- Tokens inherit the permissions of the Jellyfin user
- Session tokens can be revoked from Jellyfin's device management
