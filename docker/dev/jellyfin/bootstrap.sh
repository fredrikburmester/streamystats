#!/usr/bin/env bash
# Turns a factory-fresh Jellyfin container into a usable test server through
# its REST API: completes the startup wizard, creates an admin plus regular
# users, adds Movies/Shows/Music libraries pointing at the generated media
# (with internet metadata fetchers disabled so scans are fast and offline),
# runs a library scan, and mints an API key for Streamystats.
# Idempotent: safe to re-run against an already bootstrapped server.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JELLYFIN_URL="${JELLYFIN_URL:-http://localhost:${DEV_JELLYFIN_PORT:-8096}}"
ADMIN_USER="${JELLYFIN_ADMIN_USER:-admin}"
ADMIN_PASS="${JELLYFIN_ADMIN_PASS:-password}"
USERS="${JELLYFIN_USERS:-alice bob carol}"
USER_PASS="${JELLYFIN_USER_PASS:-password}"
STATE_FILE="${STATE_FILE:-$HERE/.state.env}"
AUTH_HDR='Authorization: MediaBrowser Client="streamystats-dev", Device="bootstrap", DeviceId="streamystats-dev-bootstrap", Version="1.0.0"'
TOKEN=""

command -v jq >/dev/null || { echo "jq is required (brew install jq)" >&2; exit 1; }

log() { printf '[bootstrap] %s\n' "$*" >&2; }

# api <METHOD> <path> [json-body]
api() {
  local method=$1 path=$2 body=${3:-}
  local hdr="$AUTH_HDR"
  [ -n "$TOKEN" ] && hdr="$AUTH_HDR, Token=\"$TOKEN\""
  if [ -n "$body" ]; then
    curl -sS --fail-with-body -X "$method" "$JELLYFIN_URL$path" -H "$hdr" \
      -H 'Content-Type: application/json' --data "$body"
  else
    curl -sS --fail-with-body -X "$method" "$JELLYFIN_URL$path" -H "$hdr"
  fi
}

urlenc() { jq -rn --arg s "$1" '$s|@uri'; }

log "waiting for $JELLYFIN_URL/health"
for _ in $(seq 1 90); do
  curl -fsS "$JELLYFIN_URL/health" >/dev/null 2>&1 && break
  sleep 2
done
curl -fsS "$JELLYFIN_URL/health" >/dev/null || { log "Jellyfin never became healthy"; exit 1; }

public_info=$(curl -fsS "$JELLYFIN_URL/System/Info/Public")
log "server: $(jq -r '"\(.ServerName) \(.Version)"' <<<"$public_info")"

if [ "$(jq -r .StartupWizardCompleted <<<"$public_info")" != "true" ]; then
  log "completing startup wizard"
  api POST /Startup/Configuration '{"UICulture":"en-US","MetadataCountryCode":"US","PreferredMetadataLanguage":"en"}' >/dev/null
  api GET /Startup/User >/dev/null
  api POST /Startup/User "$(jq -n --arg n "$ADMIN_USER" --arg p "$ADMIN_PASS" '{Name:$n,Password:$p}')" >/dev/null
  api POST /Startup/RemoteAccess '{"EnableRemoteAccess":true,"EnableAutomaticPortMapping":false}' >/dev/null
  api POST /Startup/Complete >/dev/null
else
  log "startup wizard already completed"
fi

auth=$(api POST /Users/AuthenticateByName "$(jq -n --arg u "$ADMIN_USER" --arg p "$ADMIN_PASS" '{Username:$u,Pw:$p}')")
TOKEN=$(jq -r .AccessToken <<<"$auth")
ADMIN_ID=$(jq -r .User.Id <<<"$auth")
log "authenticated as $ADMIN_USER ($ADMIN_ID)"

existing_libs=$(api GET /Library/VirtualFolders | jq -r '.[].Name')

# add_lib <name> <collectionType> <container path> <item types...>
add_lib() {
  local name=$1 ctype=$2 path=$3
  shift 3
  if grep -qx "$name" <<<"$existing_libs"; then
    log "library '$name' exists"
    return 0
  fi
  local typeopts body
  typeopts=$(printf '%s\n' "$@" | jq -R . | jq -s 'map({Type:., MetadataFetchers:[], MetadataFetcherOrder:[], ImageFetchers:[], ImageFetcherOrder:[], ImageOptions:[]})')
  body=$(jq -n --arg p "$path" --argjson t "$typeopts" '{
    LibraryOptions: {
      PathInfos: [{Path: $p}],
      EnableRealtimeMonitor: false,
      EnableChapterImageExtraction: false,
      ExtractChapterImagesDuringLibraryScan: false,
      EnableTrickplayImageExtraction: false,
      ExtractTrickplayImagesDuringLibraryScan: false,
      SaveLocalMetadata: false,
      EnableEmbeddedTitles: true,
      TypeOptions: $t
    }
  }')
  log "creating library '$name' ($ctype -> $path)"
  api POST "/Library/VirtualFolders?name=$(urlenc "$name")&collectionType=$ctype&refreshLibrary=false" "$body" >/dev/null
}

add_lib Movies movies /media/movies Movie
add_lib Shows tvshows /media/shows Series Season Episode
add_lib Music music /media/music MusicArtist MusicAlbum Audio

for u in $USERS; do
  uid=$(api GET /Users | jq -r --arg n "$u" '.[] | select(.Name == $n) | .Id')
  if [ -z "$uid" ]; then
    uid=$(api POST /Users/New "$(jq -n --arg n "$u" --arg p "$USER_PASS" '{Name:$n,Password:$p}')" | jq -r .Id)
    log "created user $u ($uid)"
  else
    log "user $u exists ($uid)"
  fi
  policy=$(api GET "/Users/$uid" | jq '.Policy')
  if [ "$(jq -r .EnableAllFolders <<<"$policy")" != "true" ]; then
    api POST "/Users/$uid/Policy" "$(jq '.EnableAllFolders = true' <<<"$policy")" >/dev/null
    log "granted $u access to all libraries"
  fi
done

log "starting library scan"
api POST /Library/Refresh >/dev/null
sleep 4
task_state() { api GET /ScheduledTasks | jq -r '.[] | select(.Key == "RefreshLibrary") | .State'; }
for _ in $(seq 1 150); do
  [ "$(task_state)" = "Idle" ] && break
  sleep 2
done
count=$(api GET "/Items?Recursive=true&IncludeItemTypes=Movie,Episode,Audio&Limit=0" | jq .TotalRecordCount)
log "scan finished: $count playable items"

api_key=$(api GET /Auth/Keys | jq -r '.Items[] | select(.AppName == "Streamystats") | .AccessToken' | head -n1)
if [ -z "$api_key" ]; then
  api POST "/Auth/Keys?app=Streamystats" >/dev/null
  api_key=$(api GET /Auth/Keys | jq -r '.Items[] | select(.AppName == "Streamystats") | .AccessToken' | head -n1)
  log "created API key for Streamystats"
fi

cat >"$STATE_FILE" <<STATE
JELLYFIN_URL=$JELLYFIN_URL
JELLYFIN_VERSION=$(jq -r .Version <<<"$public_info")
JELLYFIN_ADMIN_USER=$ADMIN_USER
JELLYFIN_ADMIN_PASS=$ADMIN_PASS
JELLYFIN_ADMIN_ID=$ADMIN_ID
JELLYFIN_ADMIN_TOKEN=$TOKEN
JELLYFIN_API_KEY=$api_key
JELLYFIN_USERS="$USERS"
JELLYFIN_USER_PASS=$USER_PASS
STATE

log "ready. Web UI: $JELLYFIN_URL  admin: $ADMIN_USER/$ADMIN_PASS  users: $USERS ($USER_PASS)"
log "API key for Streamystats onboarding: $api_key"
