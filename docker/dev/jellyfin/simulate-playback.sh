#!/usr/bin/env bash
# Pretends to be a Jellyfin client playing an item, using the same playback
# reporting endpoints real clients use (/Sessions/Playing, /Progress, /Stopped).
# The session then shows up in GET /Sessions for Streamystats' poller, and
# Jellyfin writes the matching activity-log entries.
#
#   simulate-playback.sh [-u user] [-p pass] [-i "search term"] [-d seconds]
#                        [-c client] [-m DirectPlay|DirectStream|Transcode] [-P]
#
#   -i  substring of the item name; omitted = random playable item
#   -P  pause for a while halfway through
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$HERE/.state.env" ] && . "$HERE/.state.env"

JELLYFIN_URL="${JELLYFIN_URL:-http://localhost:${DEV_JELLYFIN_PORT:-8096}}"
USER_NAME="${JELLYFIN_PLAY_USER:-alice}"
USER_PASS="${JELLYFIN_USER_PASS:-password}"
SEARCH=""
DURATION=45
CLIENT="Jellyfin Web"
METHOD="DirectPlay"
PAUSE=0

while getopts "u:p:i:d:c:m:P" opt; do
  case $opt in
    u) USER_NAME=$OPTARG ;;
    p) USER_PASS=$OPTARG ;;
    i) SEARCH=$OPTARG ;;
    d) DURATION=$OPTARG ;;
    c) CLIENT=$OPTARG ;;
    m) METHOD=$OPTARG ;;
    P) PAUSE=1 ;;
    *) exit 2 ;;
  esac
done

command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

device_id="sim-$(tr -c 'A-Za-z0-9' '-' <<<"$CLIENT-$USER_NAME" | tr -s '-')"
AUTH_HDR="Authorization: MediaBrowser Client=\"$CLIENT\", Device=\"$USER_NAME's $CLIENT\", DeviceId=\"$device_id\", Version=\"1.0.0\""
TOKEN=""

log() { printf '[play:%s] %s\n' "$USER_NAME" "$*" >&2; }

api() {
  local method=$1 path=$2 body=${3:-}
  local hdr="$AUTH_HDR"
  [ -n "$TOKEN" ] && hdr="$AUTH_HDR, Token=\"$TOKEN\""
  if [ -n "$body" ]; then
    curl -sS --fail-with-body -X "$method" "$JELLYFIN_URL$path" -H "$hdr" -H 'Content-Type: application/json' --data "$body"
  else
    curl -sS --fail-with-body -X "$method" "$JELLYFIN_URL$path" -H "$hdr"
  fi
}

auth=$(api POST /Users/AuthenticateByName "$(jq -n --arg u "$USER_NAME" --arg p "$USER_PASS" '{Username:$u,Pw:$p}')")
TOKEN=$(jq -r .AccessToken <<<"$auth")
USER_ID=$(jq -r .User.Id <<<"$auth")

query="/Items?userId=$USER_ID&Recursive=true&IncludeItemTypes=Movie,Episode,Audio&Fields=MediaSources,RunTimeTicks&Limit=100"
[ -n "$SEARCH" ] && query="$query&SearchTerm=$(jq -rn --arg s "$SEARCH" '$s|@uri')"
items=$(api GET "$query")
total=$(jq '.Items | length' <<<"$items")
[ "$total" -gt 0 ] || { log "no playable items matched"; exit 1; }
item=$(jq -c --argjson n "$((RANDOM % total))" '.Items[$n]' <<<"$items")
ITEM_ID=$(jq -r .Id <<<"$item")
ITEM_NAME=$(jq -r '[.SeriesName, .Name] | map(select(. != null)) | join(" - ")' <<<"$item")
MEDIA_SOURCE_ID=$(jq -r '.MediaSources[0].Id // .Id' <<<"$item")
PLAY_SESSION_ID=$(uuidgen | tr 'A-Z' 'a-z')

state() {
  local pos=$1 paused=$2
  jq -n --arg i "$ITEM_ID" --arg ms "$MEDIA_SOURCE_ID" --arg ps "$PLAY_SESSION_ID" \
    --arg pm "$METHOD" --argjson pos "$pos" --argjson paused "$paused" '{
      ItemId: $i, MediaSourceId: $ms, PlaySessionId: $ps, PlayMethod: $pm,
      PositionTicks: $pos, IsPaused: $paused, CanSeek: true, IsMuted: false,
      VolumeLevel: 100, AudioStreamIndex: 1, SubtitleStreamIndex: -1,
      RepeatMode: "RepeatNone", PlaybackOrder: "Default"
    }'
}

log "playing '$ITEM_NAME' ($ITEM_ID) as $CLIENT via $METHOD for ${DURATION}s"
api POST /Sessions/Playing "$(state 0 false)" >/dev/null

elapsed=0
paused=false
while [ "$elapsed" -lt "$DURATION" ]; do
  sleep 5
  if [ "$paused" = false ]; then elapsed=$((elapsed + 5)); fi
  if [ "$PAUSE" = 1 ] && [ "$paused" = false ] && [ "$elapsed" -ge $((DURATION / 2)) ]; then
    paused=true
    PAUSE=0
    log "paused at ${elapsed}s"
    api POST /Sessions/Playing/Progress "$(state $((elapsed * 10000000)) true)" >/dev/null
    sleep 12
    paused=false
    log "resumed"
  fi
  api POST /Sessions/Playing/Progress "$(state $((elapsed * 10000000)) $paused)" >/dev/null
done

api POST /Sessions/Playing/Stopped "$(jq -n --arg i "$ITEM_ID" --arg ms "$MEDIA_SOURCE_ID" --arg ps "$PLAY_SESSION_ID" \
  --argjson pos $((elapsed * 10000000)) '{ItemId:$i, MediaSourceId:$ms, PlaySessionId:$ps, PositionTicks:$pos}')" >/dev/null
log "stopped after ${elapsed}s"
