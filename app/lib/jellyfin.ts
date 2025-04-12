export interface CollectionFolder {
  Name: string;
  ServerId: string;
  Id: string;
  Etag: string;
  DateCreated: string;
  CanDelete: boolean;
  CanDownload: boolean;
  SortName: string;
  ExternalUrls: string[];
  Path: string;
  EnableMediaSourceDisplay: boolean;
  ChannelId: null | string;
  Taglines: string[];
  Genres: string[];
  RemoteTrailers: any[];
  ProviderIds: Record<string, string>;
  IsFolder: boolean;
  ParentId: string;
  Type: string;
  People: any[];
  Studios: any[];
  GenreItems: any[];
  LocalTrailerCount: number;
  SpecialFeatureCount: number;
  DisplayPreferencesId: string;
  Tags: string[];
  PrimaryImageAspectRatio: number;
  CollectionType: string;
  ImageTags: {
    Primary: string;
  };
  BackdropImageTags: string[];
  ImageBlurHashes: {
    Primary: {
      [key: string]: string;
    };
  };
  LocationType: string;
  MediaType: string;
  LockedFields: any[];
  LockData: boolean;
}

/**
 * Fetches libraries from a Jellyfin server
 * @param serverIdOrConfig Server ID or direct connection config with url and apiKey
 * @returns The libraries from the Jellyfin server
 */
export async function getLibrariesDirectlyFromJellyfin(serverIdOrConfig: {
  url: string;
  api_key: string;
}): Promise<CollectionFolder[]> {
  // Make the API request to Jellyfin
  const response = await fetch(`${serverIdOrConfig.url}/Library/MediaFolders`, {
    method: "GET",
    headers: {
      "X-Emby-Token": serverIdOrConfig.api_key,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    console.error(`Jellyfin API returned ${response.status}`);
    return [];
  }

  const data = await response.json();

  // Filter out boxsets and playlists
  return data.Items.filter(
    (library: any) =>
      library.CollectionType !== "boxsets" &&
      library.CollectionType !== "playlists"
  );
}
