#!/usr/bin/env bash
# Generates a tiny synthetic media library (movies, a show, an album) for the
# local Jellyfin test server. Files are ffmpeg test patterns, so no real media
# is needed and the whole set builds in well under a minute. NFO sidecars give
# Jellyfin people/genres/provider ids without any internet metadata fetchers.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MEDIA_DIR="${MEDIA_DIR:-$HERE/media}"
JELLYFIN_IMAGE_TAG="${JELLYFIN_IMAGE_TAG:-12.0}"

mkdir -p "$MEDIA_DIR"
cd "$MEDIA_DIR"

if command -v ffmpeg >/dev/null 2>&1; then
  ff() { ffmpeg -hide_banner -loglevel error -y "$@"; }
else
  # Fall back to the ffmpeg bundled in the Jellyfin image; paths are relative to MEDIA_DIR.
  ff() {
    docker run --rm -v "$MEDIA_DIR:/media" -w /media \
      --entrypoint /usr/lib/jellyfin-ffmpeg/ffmpeg "jellyfin/jellyfin:$JELLYFIN_IMAGE_TAG" \
      -hide_banner -loglevel error -y "$@"
  }
fi

log() { printf '[media] %s\n' "$*" >&2; }

# video <out> <seconds> <WxH> <title> <hue>
video() {
  local out=$1 secs=$2 size=$3 title=$4 hue=${5:-0}
  [ -f "$out" ] && return 0
  mkdir -p "$(dirname "$out")"
  log "video $out"
  ff -f lavfi -i "testsrc2=size=$size:rate=24" -f lavfi -i "sine=frequency=440:sample_rate=44100" \
    -t "$secs" -vf "hue=h=$hue" -c:v libx264 -preset ultrafast -pix_fmt yuv420p \
    -c:a aac -b:a 64k -metadata title="$title" -movflags +faststart "$out"
}

# image <out> <WxH> <hue>
image() {
  local out=$1 size=$2 hue=${3:-0}
  [ -f "$out" ] && return 0
  mkdir -p "$(dirname "$out")"
  ff -f lavfi -i "testsrc2=size=$size" -frames:v 1 -vf "hue=h=$hue" -update 1 "$out"
}

# audio <out> <seconds> <freq> <title> <artist> <album> <track> <year>
audio() {
  local out=$1 secs=$2 freq=$3 title=$4 artist=$5 album=$6 track=$7 year=$8
  [ -f "$out" ] && return 0
  mkdir -p "$(dirname "$out")"
  log "audio $out"
  ff -f lavfi -i "sine=frequency=$freq:sample_rate=44100" -t "$secs" -c:a flac \
    -metadata title="$title" -metadata artist="$artist" -metadata album_artist="$artist" \
    -metadata album="$album" -metadata track="$track" -metadata date="$year" "$out"
}

nfo_actors() {
  local a
  for a in "$@"; do
    printf '  <actor><name>%s</name><role>%s</role></actor>\n' "${a%%:*}" "${a#*:}"
  done
}

nfo_genres() {
  local g
  IFS=, read -ra gs <<<"$1"
  for g in "${gs[@]}"; do printf '  <genre>%s</genre>\n' "$g"; done
}

# nfo_movie <out> <title> <year> <imdb> <tmdb> <genres> <director> <writer> <plot> <actor:role>...
nfo_movie() {
  local out=$1 title=$2 year=$3 imdb=$4 tmdb=$5 genres=$6 director=$7 writer=$8 plot=$9
  shift 9
  {
    echo '<?xml version="1.0" encoding="utf-8" standalone="yes"?>'
    echo '<movie>'
    printf '  <title>%s</title>\n  <year>%s</year>\n  <premiered>%s-05-20</premiered>\n' "$title" "$year" "$year"
    printf '  <plot>%s</plot>\n  <mpaa>PG</mpaa>\n  <rating>7.8</rating>\n  <studio>Blender Foundation</studio>\n' "$plot"
    printf '  <uniqueid type="imdb" default="true">%s</uniqueid>\n  <uniqueid type="tmdb">%s</uniqueid>\n' "$imdb" "$tmdb"
    nfo_genres "$genres"
    printf '  <director>%s</director>\n  <credits>%s</credits>\n' "$director" "$writer"
    nfo_actors "$@"
    echo '</movie>'
  } >"$out"
}

# nfo_tvshow <out> <title> <year> <imdb> <tvdb> <genres> <plot> <actor:role>...
nfo_tvshow() {
  local out=$1 title=$2 year=$3 imdb=$4 tvdb=$5 genres=$6 plot=$7
  shift 7
  {
    echo '<?xml version="1.0" encoding="utf-8" standalone="yes"?>'
    echo '<tvshow>'
    printf '  <title>%s</title>\n  <year>%s</year>\n  <premiered>%s-01-10</premiered>\n  <plot>%s</plot>\n' "$title" "$year" "$year" "$plot"
    printf '  <mpaa>TV-PG</mpaa>\n  <rating>8.4</rating>\n  <status>Continuing</status>\n  <studio>Test Studios</studio>\n'
    printf '  <uniqueid type="imdb" default="true">%s</uniqueid>\n  <uniqueid type="tvdb">%s</uniqueid>\n' "$imdb" "$tvdb"
    nfo_genres "$genres"
    nfo_actors "$@"
    echo '</tvshow>'
  } >"$out"
}

# nfo_episode <out> <title> <season> <episode> <aired> <director> <writer> <plot> <actor:role>...
nfo_episode() {
  local out=$1 title=$2 season=$3 episode=$4 aired=$5 director=$6 writer=$7 plot=$8
  shift 8
  {
    echo '<?xml version="1.0" encoding="utf-8" standalone="yes"?>'
    echo '<episodedetails>'
    printf '  <title>%s</title>\n  <season>%s</season>\n  <episode>%s</episode>\n  <aired>%s</aired>\n' "$title" "$season" "$episode" "$aired"
    printf '  <plot>%s</plot>\n  <rating>7.9</rating>\n  <director>%s</director>\n  <credits>%s</credits>\n' "$plot" "$director" "$writer"
    nfo_actors "$@"
    echo '</episodedetails>'
  } >"$out"
}

# ---------------------------------------------------------------------------
# Movies (one with two alternate versions in the same folder)
# ---------------------------------------------------------------------------
m="movies/Big Buck Bunny (2008)"
video "$m/Big Buck Bunny (2008).mp4" 90 640x360 "Big Buck Bunny" 0
image "$m/poster.jpg" 400x600 0
image "$m/backdrop.jpg" 1280x720 0
nfo_movie "$m/Big Buck Bunny (2008).nfo" "Big Buck Bunny" 2008 tt1254207 10378 "Animation,Comedy" \
  "Sacha Goedegebure" "Sacha Goedegebure" "A giant rabbit takes revenge on three bullying rodents." \
  "Frank Gruber:Big Buck Bunny" "Jan Morgenstern:Frank the Squirrel"

m="movies/Sintel (2010)"
video "$m/Sintel (2010).mp4" 75 640x360 "Sintel" 60
image "$m/poster.jpg" 400x600 60
image "$m/backdrop.jpg" 1280x720 60
nfo_movie "$m/Sintel (2010).nfo" "Sintel" 2010 tt1727587 45745 "Animation,Fantasy,Adventure" \
  "Colin Levy" "Esther Wouda" "A lonely girl searches for the baby dragon she befriended." \
  "Halina Reijn:Sintel" "Thom Hoffman:Shaman" "Frank Gruber:Guard"

m="movies/Tears of Steel (2012)"
video "$m/Tears of Steel (2012).mp4" 60 640x360 "Tears of Steel" 120
image "$m/poster.jpg" 400x600 120
image "$m/backdrop.jpg" 1280x720 120
nfo_movie "$m/Tears of Steel (2012).nfo" "Tears of Steel" 2012 tt2285752 133701 "Science Fiction,Short" \
  "Ian Hubbard" "Ian Hubbard" "A group of warriors and scientists fight to save the world from robots." \
  "Derek de Lint:Thom" "Sergio Hasselbaink:Barley" "Halina Reijn:Celia"

# Alternate versions: Jellyfin groups files named "<movie> - <label>" in one folder.
m="movies/Elephants Dream (2006)"
video "$m/Elephants Dream (2006) - 1080p.mp4" 60 1280x720 "Elephants Dream" 200
video "$m/Elephants Dream (2006) - 720p.mp4" 60 640x360 "Elephants Dream" 200
image "$m/poster.jpg" 400x600 200
nfo_movie "$m/Elephants Dream (2006).nfo" "Elephants Dream" 2006 tt0807840 9761 "Animation,Science Fiction" \
  "Bassam Kurdali" "Bassam Kurdali" "Two characters explore a surreal industrial machine world." \
  "Tygo Gernandt:Proog" "Cas Jansen:Emo"

# ---------------------------------------------------------------------------
# TV show: 2 seasons, one episode with two alternate versions (new in Jellyfin 12)
# ---------------------------------------------------------------------------
s="shows/Cosmos Lab (2021)"
image "$s/folder.jpg" 400x600 280
image "$s/backdrop.jpg" 1280x720 280
nfo_tvshow "$s/tvshow.nfo" "Cosmos Lab" 2021 tt9900001 400001 "Documentary,Science" \
  "A small crew runs experiments aboard an orbiting laboratory." \
  "Ada Chen:Dr. Ada Chen" "Marcus Oyelaran:Marcus" "Frank Gruber:Mission Control"

image "$s/Season 01/folder.jpg" 400x600 290
i=1
for ep in "Pilot" "First Light" "Zero G"; do
  f="$s/Season 01/Cosmos Lab S01E0$i"
  video "$f.mp4" $((40 + i * 10)) 640x360 "$ep" $((280 + i * 10))
  image "$f-thumb.jpg" 640x360 $((280 + i * 10))
  nfo_episode "$f.nfo" "$ep" 1 "$i" "2021-01-$((10 + i * 7))" "Ada Chen" "Ada Chen" \
    "Episode $i of season one." "Ada Chen:Dr. Ada Chen" "Marcus Oyelaran:Marcus"
  i=$((i + 1))
done

image "$s/Season 02/folder.jpg" 400x600 320
f="$s/Season 02/Cosmos Lab S02E01"
video "$f.mp4" 55 640x360 "Re-entry" 330
image "$f-thumb.jpg" 640x360 330
nfo_episode "$f.nfo" "Re-entry" 2 1 "2022-02-14" "Marcus Oyelaran" "Ada Chen" \
  "The crew returns after a long stint." "Ada Chen:Dr. Ada Chen" "Marcus Oyelaran:Marcus" "Priya Nair:Flight Director"

f="$s/Season 02/Cosmos Lab S02E02"
video "$f - 1080p.mp4" 55 1280x720 "Splashdown" 340
video "$f - 720p.mp4" 55 640x360 "Splashdown" 340
image "$f - 1080p-thumb.jpg" 640x360 340
nfo_episode "$f - 1080p.nfo" "Splashdown" 2 2 "2022-02-21" "Marcus Oyelaran" "Priya Nair" \
  "Two cuts of the same landing." "Ada Chen:Dr. Ada Chen" "Priya Nair:Flight Director"

# ---------------------------------------------------------------------------
# Music: one artist, one album
# ---------------------------------------------------------------------------
a="music/The Test Tones/Sine Waves (2019)"
image "$a/folder.jpg" 600x600 40
audio "$a/01 - Low Hum.flac" 45 110 "Low Hum" "The Test Tones" "Sine Waves" 1 2019
audio "$a/02 - Concert A.flac" 40 440 "Concert A" "The Test Tones" "Sine Waves" 2 2019
audio "$a/03 - High Whistle.flac" 35 1760 "High Whistle" "The Test Tones" "Sine Waves" 3 2019

log "done: $(find . -type f \( -name '*.mp4' -o -name '*.flac' \) | wc -l | tr -d ' ') media files in $MEDIA_DIR"
