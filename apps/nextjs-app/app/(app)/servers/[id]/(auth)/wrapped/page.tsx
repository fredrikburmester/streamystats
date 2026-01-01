import { redirect } from "next/navigation";
import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServer } from "@/lib/db/server";
import { getAvailableWrappedYears } from "@/lib/db/wrapped";
import { getMe } from "@/lib/me";
import { Calendar, Sparkles } from "lucide-react";
import Link from "next/link";

export default async function WrappedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const server = await getServer({ serverId: id });

  if (!server) {
    redirect("/");
  }

  const me = await getMe();
  if (!me) {
    redirect(`/servers/${id}/login`);
  }

  const availableYears = await getAvailableWrappedYears(server.id, me.id);
  const currentYear = new Date().getFullYear();

  // If there's data for the current year, redirect to it
  if (availableYears.includes(currentYear)) {
    redirect(`/servers/${id}/wrapped/${currentYear}`);
  }

  // If there are any years available, redirect to the most recent one
  if (availableYears.length > 0) {
    redirect(`/servers/${id}/wrapped/${availableYears[0]}`);
  }

  // No data available
  return (
    <Container className="flex flex-col items-center justify-center min-h-[60vh]">
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>No Wrapped Data Yet</CardTitle>
          <CardDescription>
            Start watching some content and come back later to see your year in review!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/servers/${id}/library`}>
            <Button>
              <Calendar className="mr-2 h-4 w-4" />
              Browse Library
            </Button>
          </Link>
        </CardContent>
      </Card>
    </Container>
  );
}
