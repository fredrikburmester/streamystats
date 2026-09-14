import {
  Clock,
  Film,
  Fingerprint,
  Palette,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { ResponsiveFingerprint } from "@/components/TasteFingerprint";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServer } from "@/lib/db/server";
import { getUserTasteProfile } from "@/lib/db/taste-profile";
import { getUserById } from "@/lib/db/users";
import { formatDuration } from "@/lib/utils";

export default async function FingerprintPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  const { id, userId } = await params;
  const server = await getServer({ serverId: id });

  if (!server) {
    redirect("/");
  }

  const user = await getUserById({ userId, serverId: server.id });
  if (!user) {
    redirect("/");
  }

  const profile = await getUserTasteProfile(server.id, userId, user.name);

  const topGenres = Object.entries(profile.genreWeights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const hasData = profile.itemCount > 0 && profile.embedding !== null;

  const getComplexityLabel = (complexity: number) => {
    if (complexity < 0.25) return "Focused";
    if (complexity < 0.5) return "Balanced";
    if (complexity < 0.75) return "Diverse";
    return "Eclectic";
  };

  return (
    <Container className="flex flex-col gap-6 w-full">
      <div className="flex items-center gap-3">
        <div
          className="p-2 rounded-xl"
          style={{
            background: `linear-gradient(135deg, hsla(${profile.dominantHue}, 60%, 40%, 0.3), hsla(${profile.secondaryHue}, 60%, 40%, 0.3))`,
          }}
        >
          <Fingerprint className="w-6 h-6 text-primary" />
        </div>
        <div>
          <PageTitle title="Taste Fingerprint" />
          <p className="text-muted-foreground text-sm">
            {user.name}&apos;s unique watching profile
          </p>
        </div>
      </div>

      {hasData ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] xl:grid-cols-[1fr,500px] gap-6">
          {/* Left side - Stats and genres */}
          <div className="flex flex-col gap-4 order-2 lg:order-1">
            {/* Stats cards row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-background/40 backdrop-blur-md border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Sparkles className="w-3 h-3" />
                    Complexity
                  </div>
                  <div className="text-2xl font-bold">
                    {Math.round(profile.complexity * 100)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getComplexityLabel(profile.complexity)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/40 backdrop-blur-md border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Film className="w-3 h-3" />
                    Items
                  </div>
                  <div className="text-2xl font-bold">{profile.itemCount}</div>
                  <div className="text-xs text-muted-foreground">
                    with embeddings
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/40 backdrop-blur-md border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Clock className="w-3 h-3" />
                    Watch Time
                  </div>
                  <div className="text-2xl font-bold">
                    {Math.round(profile.totalWatchTime / 3600)}h
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDuration(profile.totalWatchTime)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/40 backdrop-blur-md border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <TrendingUp className="w-3 h-3" />
                    Genres
                  </div>
                  <div className="text-2xl font-bold">{topGenres.length}</div>
                  <div className="text-xs text-muted-foreground">
                    top categories
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Genres card */}
            <Card className="bg-background/40 backdrop-blur-md border-white/10 flex-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="w-4 h-4 text-primary" />
                  Your Taste Profile
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Genres by watch time (items can have multiple genres)
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {topGenres.map(([genre, weight], index) => {
                  const hue = (profile.dominantHue + index * 25) % 360;
                  // Scale bar to max genre for better visual (but show actual %)
                  const maxWeight = topGenres[0]?.[1] || 1;
                  const barWidth = (weight / maxWeight) * 100;

                  return (
                    <div key={genre} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{genre}</span>
                        <span
                          className="font-mono text-xs"
                          style={{ color: `hsla(${hue}, 60%, 70%, 0.9)` }}
                        >
                          {Math.round(weight * 100)}%
                        </span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${barWidth}%`,
                            background: `linear-gradient(90deg, hsla(${hue}, 70%, 50%, 0.9), hsla(${hue}, 50%, 40%, 0.7))`,
                            boxShadow: `0 0 10px hsla(${hue}, 70%, 50%, 0.3)`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {topGenres.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    No genre data available
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Info text */}
            <div className="text-xs text-muted-foreground bg-white/5 rounded-lg p-4">
              <p className="flex items-start gap-2">
                <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  Your fingerprint is generated from AI embeddings of your watch
                  history. The colors, ring patterns, and shapes are unique to
                  your taste profile. Download or share it to show your watching
                  personality!
                </span>
              </p>
            </div>
          </div>

          {/* Right side - Fingerprint */}
          <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
            <ResponsiveFingerprint profile={profile} animated showControls />
          </div>
        </div>
      ) : (
        <Card className="max-w-lg mx-auto text-center p-8">
          <CardContent className="space-y-4">
            <Fingerprint className="w-20 h-20 mx-auto text-muted-foreground/30" />
            <div>
              <h3 className="font-semibold text-lg mb-2">
                No Fingerprint Available
              </h3>
              <p className="text-sm text-muted-foreground">
                {profile.itemCount === 0
                  ? "Start watching content to generate your unique taste fingerprint."
                  : "Embeddings need to be generated for your watched content. Check the server settings to enable embeddings."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}
