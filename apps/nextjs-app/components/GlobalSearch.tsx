"use client";

import {
  ActivitySquare,
  Clock,
  Disc,
  Film,
  ListVideo,
  Music,
  Search,
  Tv,
  User,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { SearchResult, SearchResults } from "@/lib/db/search";

interface GlobalSearchProps {
  serverUrl?: string;
}

function getItemIcon(type?: string) {
  switch (type) {
    case "Movie":
      return Film;
    case "Series":
      return Tv;
    case "Episode":
      return Tv;
    case "Audio":
    case "MusicAlbum":
    case "MusicArtist":
      return Music;
    case "MusicVideo":
      return Disc;
    default:
      return Film;
  }
}

function getResultIcon(result: SearchResult) {
  switch (result.type) {
    case "item":
      return getItemIcon(result.subtype);
    case "user":
      return User;
    case "watchlist":
      return ListVideo;
    case "activity":
      return ActivitySquare;
    case "session":
      return Clock;
    case "actor":
      return Users;
    default:
      return Search;
  }
}

function SearchResultItem({
  result,
  serverId,
  serverUrl,
  onSelect,
}: {
  result: SearchResult;
  serverId: string;
  serverUrl?: string;
  onSelect: () => void;
}) {
  const router = useRouter();
  const Icon = getResultIcon(result);

  const handleSelect = useCallback(() => {
    router.push(`/servers/${serverId}${result.href}`);
    onSelect();
  }, [router, serverId, result.href, onSelect]);

  // Build image URL for items and actors
  let imageUrl: string | undefined;
  if (
    (result.type === "item" || result.type === "actor") &&
    result.imageId &&
    result.imageTag &&
    serverUrl
  ) {
    imageUrl = `${serverUrl}/Items/${result.imageId}/Images/Primary?tag=${result.imageTag}&quality=90&maxWidth=80`;
  }

  return (
    <CommandItem
      value={`${result.type}-${result.id}-${result.title}`}
      onSelect={handleSelect}
      className="flex items-center gap-3 py-2 cursor-pointer"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          width={32}
          height={40}
          className="h-10 w-8 rounded object-cover bg-muted flex-shrink-0"
          unoptimized
        />
      ) : (
        <div className="h-10 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-medium truncate">{result.title}</span>
        {result.subtitle && (
          <span className="text-xs text-muted-foreground truncate">
            {result.subtitle}
          </span>
        )}
      </div>
      <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
        <span className="text-xs text-muted-foreground capitalize">
          {result.subtype ?? result.type}
        </span>
        {result.type === "item" && result.metadata?.libraryName && (
          <span className="text-[10px] text-muted-foreground">
            {result.metadata.libraryName}
          </span>
        )}
        {(result.type === "activity" || result.type === "session") &&
          result.metadata?.date && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(result.metadata.date).toLocaleDateString()}{" "}
              {new Date(result.metadata.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
      </div>
    </CommandItem>
  );
}

export function GlobalSearch({ serverUrl }: GlobalSearchProps) {
  const params = useParams();
  const serverId = params.id as string;
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Fetch search results
  useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedQuery.trim()) {
        setResults(null);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=10`,
        );
        if (response.ok) {
          const data = await response.json();
          setResults(data.data);
        }
      } catch (error) {
        // Silently fail
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [debouncedQuery]);

  const handleInputFocus = useCallback(() => {
    setOpen(true);
  }, []);

  const handleSelect = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(null);
  }, []);

  const hasResults = results && results.total > 0;
  const showDropdown = open && (query.trim().length > 0 || isLoading);

  return (
    <div ref={containerRef} className="relative w-full max-w-xl ml-auto">
      <Command
        className="rounded-lg border shadow-none bg-background"
        shouldFilter={false}
      >
        <div className="flex items-center border-0 px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleInputFocus}
            placeholder="Search..."
            className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {showDropdown && (
          <CommandList className="absolute top-full left-0 right-0 z-50 mt-1 max-h-[400px] overflow-y-auto rounded-lg border bg-popover shadow-lg">
            {isLoading && !results && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            )}

            {!isLoading && !hasResults && query.trim() && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}

            {hasResults && (
              <>
                {results.items.length > 0 && (
                  <CommandGroup heading="Media">
                    {results.items.map((item) => (
                      <SearchResultItem
                        key={`item-${item.id}`}
                        result={item}
                        serverId={serverId}
                        serverUrl={serverUrl}
                        onSelect={handleSelect}
                      />
                    ))}
                  </CommandGroup>
                )}

                {results.actors && results.actors.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Cast & Crew">
                      {results.actors.map((actor) => (
                        <SearchResultItem
                          key={`actor-${actor.id}`}
                          result={actor}
                          serverId={serverId}
                          serverUrl={serverUrl}
                          onSelect={handleSelect}
                        />
                      ))}
                    </CommandGroup>
                  </>
                )}

                {results.users.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Users">
                      {results.users.map((user) => (
                        <SearchResultItem
                          key={`user-${user.id}`}
                          result={user}
                          serverId={serverId}
                          serverUrl={serverUrl}
                          onSelect={handleSelect}
                        />
                      ))}
                    </CommandGroup>
                  </>
                )}

                {results.watchlists.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Watchlists">
                      {results.watchlists.map((wl) => (
                        <SearchResultItem
                          key={`watchlist-${wl.id}`}
                          result={wl}
                          serverId={serverId}
                          serverUrl={serverUrl}
                          onSelect={handleSelect}
                        />
                      ))}
                    </CommandGroup>
                  </>
                )}

                {results.activities.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Activities">
                      {results.activities.map((activity) => (
                        <SearchResultItem
                          key={`activity-${activity.id}`}
                          result={activity}
                          serverId={serverId}
                          serverUrl={serverUrl}
                          onSelect={handleSelect}
                        />
                      ))}
                    </CommandGroup>
                  </>
                )}

                {results.sessions.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="History">
                      {results.sessions.map((session) => (
                        <SearchResultItem
                          key={`session-${session.id}`}
                          result={session}
                          serverId={serverId}
                          serverUrl={serverUrl}
                          onSelect={handleSelect}
                        />
                      ))}
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
}
