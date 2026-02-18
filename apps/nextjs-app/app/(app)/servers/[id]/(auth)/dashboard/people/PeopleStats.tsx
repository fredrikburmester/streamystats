import type { MediaTypeFilter, PlayCountSortBy } from "@/lib/db/people-stats";
import {
  getTopDirectorActorCombinations,
  getTopPeopleByLibraryPresence,
  getTopPeopleByPlayCount,
  getTopPeopleByWatchTime,
} from "@/lib/db/people-stats";
import type { ServerPublic } from "@/lib/types";
import { DirectorActorCombinations } from "./DirectorActorCombinations";
import { PeopleSection } from "./PeopleSection";

interface Props {
  server: ServerPublic;
  mediaType: MediaTypeFilter;
  playCountSort: PlayCountSortBy;
}

export async function PeopleStats({ server, mediaType, playCountSort }: Props) {
  const [
    topActorsByWatchTime,
    topActorsByPlayCount,
    topActorsByLibrary,
    topDirectorsByWatchTime,
    topDirectorsByPlayCount,
    topDirectorsByLibrary,
    directorActorCombos,
  ] = await Promise.all([
    getTopPeopleByWatchTime(server.id, "Actor", mediaType, 20),
    getTopPeopleByPlayCount(server.id, "Actor", mediaType, 20, playCountSort),
    getTopPeopleByLibraryPresence(server.id, "Actor", mediaType, 20),
    getTopPeopleByWatchTime(server.id, "Director", mediaType, 20),
    getTopPeopleByPlayCount(
      server.id,
      "Director",
      mediaType,
      20,
      playCountSort,
    ),
    getTopPeopleByLibraryPresence(server.id, "Director", mediaType, 20),
    getTopDirectorActorCombinations(server.id, mediaType, 15),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PeopleSection
        title="Top Actors in Library"
        description="Actors appearing in the most movies and series"
        iconType="library"
        people={topActorsByLibrary}
        server={server}
        variant="library"
        emptyMessage="No actor data available yet. Sync your library to see stats!"
      />

      <PeopleSection
        title="Top Actors by Watch Time"
        description="Most watched actors based on total viewing time"
        iconType="clock"
        people={topActorsByWatchTime}
        server={server}
        variant="watchtime"
        emptyMessage="No actor watch statistics yet. Watch some content to see stats!"
      />

      <PeopleSection
        title="Top Actors by Play Count"
        description="Most frequently watched actors"
        iconType="play"
        people={topActorsByPlayCount}
        server={server}
        variant="playcount"
        playCountSort={playCountSort}
        emptyMessage="No actor watch statistics yet."
      />

      <PeopleSection
        title="Top Directors in Library"
        description="Directors with the most movies and series"
        iconType="library"
        people={topDirectorsByLibrary}
        server={server}
        variant="library"
        emptyMessage="No director data available yet. Sync your library to see stats!"
      />

      <PeopleSection
        title="Top Directors by Watch Time"
        description="Most watched directors based on total viewing time"
        iconType="film"
        people={topDirectorsByWatchTime}
        server={server}
        variant="watchtime"
        emptyMessage="No director watch statistics yet."
      />

      <PeopleSection
        title="Top Directors by Play Count"
        description="Most frequently watched directors"
        iconType="trending"
        people={topDirectorsByPlayCount}
        server={server}
        variant="playcount"
        playCountSort={playCountSort}
        emptyMessage="No director watch statistics yet."
      />

      <DirectorActorCombinations
        combinations={directorActorCombos}
        server={server}
      />
    </div>
  );
}
