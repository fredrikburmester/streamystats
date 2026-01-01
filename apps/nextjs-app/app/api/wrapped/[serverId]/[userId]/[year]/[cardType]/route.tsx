import { ImageResponse } from "next/og";
import { getServer } from "@/lib/db/server";
import { getUserById, isUserAdmin } from "@/lib/db/users";
import { getWrappedData } from "@/lib/db/wrapped";
import { getSession } from "@/lib/session";
import { formatDuration } from "@/lib/utils";

export const runtime = "edge";

const CARD_TYPES = ["summary", "top-content", "watch-time", "genres"] as const;
type CardType = (typeof CARD_TYPES)[number];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serverId: string; userId: string; year: string; cardType: string }> }
) {
  const { serverId, userId, year, cardType } = await params;

  // Validate card type
  if (!CARD_TYPES.includes(cardType as CardType)) {
    return new Response("Invalid card type", { status: 400 });
  }

  // Check authentication
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Check authorization - user can only generate their own cards, admins can generate any
  const isAdmin = await isUserAdmin();
  if (session.id !== userId && !isAdmin) {
    return new Response("Forbidden", { status: 403 });
  }

  const server = await getServer({ serverId });
  if (!server) {
    return new Response("Server not found", { status: 404 });
  }

  const user = await getUserById({ userId, serverId: server.id });
  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const yearNum = Number.parseInt(year, 10);
  if (Number.isNaN(yearNum)) {
    return new Response("Invalid year", { status: 400 });
  }

  // Fetch wrapped data
  const data = await getWrappedData({
    serverId: server.id,
    userId: user.id,
    year: yearNum,
  });

  // Generate the appropriate card
  const cardElement = generateCard(cardType as CardType, data, user.name, yearNum);

  return new ImageResponse(cardElement, {
    width: 1200,
    height: 630,
  });
}

function generateCard(
  cardType: CardType,
  data: Awaited<ReturnType<typeof getWrappedData>>,
  userName: string,
  year: number
) {
  switch (cardType) {
    case "summary":
      return <SummaryCard data={data} userName={userName} year={year} />;
    case "top-content":
      return <TopContentCard data={data} userName={userName} year={year} />;
    case "watch-time":
      return <WatchTimeCard data={data} userName={userName} year={year} />;
    case "genres":
      return <GenresCard data={data} userName={userName} year={year} />;
    default:
      return <SummaryCard data={data} userName={userName} year={year} />;
  }
}

interface CardProps {
  data: Awaited<ReturnType<typeof getWrappedData>>;
  userName: string;
  year: number;
}

function SummaryCard({ data, userName, year }: CardProps) {
  const topMovie = data.topItems.movies[0];
  const topSeries = data.topItems.series[0];
  const topGenre = data.genres.topGenres[0];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #7c3aed 0%, #db2777 50%, #f97316 100%)",
        padding: "48px",
        fontFamily: "system-ui, sans-serif",
        color: "white",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "32px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            backgroundColor: "rgba(255,255,255,0.2)",
            marginRight: "24px",
            fontSize: "32px",
          }}
        >
          ✨
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "42px", fontWeight: "bold" }}>
            {userName}&apos;s {year} Wrapped
          </div>
          <div style={{ fontSize: "20px", opacity: 0.8 }}>Year in Review</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "24px",
          flex: 1,
        }}
      >
        {/* Watch Time */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "24px",
            borderRadius: "16px",
            backgroundColor: "rgba(255,255,255,0.15)",
            flex: "1 1 45%",
          }}
        >
          <div style={{ fontSize: "18px", opacity: 0.8, marginBottom: "8px" }}>
            Total Watch Time
          </div>
          <div style={{ fontSize: "48px", fontWeight: "bold" }}>
            {formatDuration(data.overview.totalWatchTimeSeconds)}
          </div>
        </div>

        {/* Total Plays */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "24px",
            borderRadius: "16px",
            backgroundColor: "rgba(255,255,255,0.15)",
            flex: "1 1 45%",
          }}
        >
          <div style={{ fontSize: "18px", opacity: 0.8, marginBottom: "8px" }}>
            Total Plays
          </div>
          <div style={{ fontSize: "48px", fontWeight: "bold" }}>
            {data.overview.totalPlays.toLocaleString()}
          </div>
        </div>

        {/* Top Movie */}
        {topMovie && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "24px",
              borderRadius: "16px",
              backgroundColor: "rgba(255,255,255,0.15)",
              flex: "1 1 45%",
            }}
          >
            <div style={{ fontSize: "18px", opacity: 0.8, marginBottom: "8px" }}>
              Top Movie
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {topMovie.name}
            </div>
          </div>
        )}

        {/* Top Genre */}
        {topGenre && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "24px",
              borderRadius: "16px",
              backgroundColor: "rgba(255,255,255,0.15)",
              flex: "1 1 45%",
            }}
          >
            <div style={{ fontSize: "18px", opacity: 0.8, marginBottom: "8px" }}>
              Top Genre
            </div>
            <div style={{ fontSize: "24px", fontWeight: "bold" }}>
              {topGenre.genre}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "24px",
          fontSize: "16px",
          opacity: 0.7,
        }}
      >
        Streamystats
      </div>
    </div>
  );
}

function TopContentCard({ data, userName, year }: CardProps) {
  const topMovie = data.topItems.movies[0];
  const topSeries = data.topItems.series[0];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
        padding: "48px",
        fontFamily: "system-ui, sans-serif",
        color: "white",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "32px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "36px", fontWeight: "bold" }}>
            {userName}&apos;s Top Content
          </div>
          <div style={{ fontSize: "20px", opacity: 0.8 }}>{year}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ display: "flex", gap: "48px", flex: 1 }}>
        {/* Top Movie */}
        {topMovie && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              padding: "32px",
              borderRadius: "16px",
              backgroundColor: "rgba(255,255,255,0.15)",
            }}
          >
            <div style={{ fontSize: "14px", opacity: 0.8, marginBottom: "16px" }}>
              🎬 TOP MOVIE
            </div>
            <div style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "8px" }}>
              {topMovie.name}
            </div>
            <div style={{ fontSize: "18px", opacity: 0.8 }}>
              {formatDuration(topMovie.totalPlayDuration)} watched
            </div>
            <div style={{ fontSize: "16px", opacity: 0.7 }}>
              {topMovie.totalPlayCount} plays
            </div>
          </div>
        )}

        {/* Top Series */}
        {topSeries && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              padding: "32px",
              borderRadius: "16px",
              backgroundColor: "rgba(255,255,255,0.15)",
            }}
          >
            <div style={{ fontSize: "14px", opacity: 0.8, marginBottom: "16px" }}>
              📺 TOP SERIES
            </div>
            <div style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "8px" }}>
              {topSeries.name}
            </div>
            <div style={{ fontSize: "18px", opacity: 0.8 }}>
              {formatDuration(topSeries.totalPlayDuration)} watched
            </div>
            <div style={{ fontSize: "16px", opacity: 0.7 }}>
              {topSeries.totalPlayCount} episodes
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "24px",
          fontSize: "16px",
          opacity: 0.7,
        }}
      >
        Streamystats
      </div>
    </div>
  );
}

function WatchTimeCard({ data, userName, year }: CardProps) {
  const hours = Math.round(data.overview.totalWatchTimeSeconds / 3600);
  const days = Math.round(hours / 24);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
        padding: "48px",
        fontFamily: "system-ui, sans-serif",
        color: "white",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "24px", opacity: 0.8, marginBottom: "16px" }}>
        {userName} in {year}
      </div>

      <div style={{ fontSize: "120px", fontWeight: "bold", lineHeight: 1 }}>
        {hours.toLocaleString()}
      </div>

      <div style={{ fontSize: "36px", opacity: 0.9, marginTop: "8px" }}>
        hours watched
      </div>

      <div
        style={{
          fontSize: "20px",
          opacity: 0.7,
          marginTop: "32px",
          padding: "16px 32px",
          borderRadius: "999px",
          backgroundColor: "rgba(255,255,255,0.15)",
        }}
      >
        That&apos;s {days} days of content!
      </div>

      <div
        style={{
          display: "flex",
          gap: "48px",
          marginTop: "48px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: "36px", fontWeight: "bold" }}>
            {data.overview.totalPlays.toLocaleString()}
          </div>
          <div style={{ fontSize: "14px", opacity: 0.7 }}>plays</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: "36px", fontWeight: "bold" }}>
            {data.overview.uniqueItemsWatched}
          </div>
          <div style={{ fontSize: "14px", opacity: 0.7 }}>titles</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: "36px", fontWeight: "bold" }}>
            {data.activityPatterns.longestStreak}
          </div>
          <div style={{ fontSize: "14px", opacity: 0.7 }}>day streak</div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "24px",
          right: "48px",
          fontSize: "16px",
          opacity: 0.7,
        }}
      >
        Streamystats
      </div>
    </div>
  );
}

function GenresCard({ data, userName, year }: CardProps) {
  const topGenres = data.genres.topGenres.slice(0, 5);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #d946ef 100%)",
        padding: "48px",
        fontFamily: "system-ui, sans-serif",
        color: "white",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ fontSize: "36px", fontWeight: "bold" }}>
          {userName}&apos;s Top Genres
        </div>
        <div style={{ fontSize: "20px", opacity: 0.8 }}>{year}</div>
      </div>

      {/* Genres */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
        {topGenres.map((genre, index) => (
          <div
            key={genre.genre}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
              padding: "20px 24px",
              borderRadius: "12px",
              backgroundColor: "rgba(255,255,255,0.15)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "rgba(255,255,255,0.2)",
                fontSize: "24px",
                fontWeight: "bold",
              }}
            >
              {index + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>{genre.genre}</div>
              <div style={{ fontSize: "14px", opacity: 0.7 }}>
                {formatDuration(genre.watchTimeSeconds)}
              </div>
            </div>
            <div style={{ fontSize: "28px", fontWeight: "bold" }}>
              {genre.percentageOfTotal}%
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "24px",
        }}
      >
        <div style={{ fontSize: "16px", opacity: 0.7 }}>
          {data.genres.totalGenresExplored} genres explored
        </div>
        <div style={{ fontSize: "16px", opacity: 0.7 }}>Streamystats</div>
      </div>
    </div>
  );
}
