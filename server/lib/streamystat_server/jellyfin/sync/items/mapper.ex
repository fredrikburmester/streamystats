defmodule StreamystatServer.Jellyfin.Sync.Items.Mapper do
  @moduledoc """
  Functions to map Jellyfin API responses to database structures.
  """

  alias StreamystatServer.Jellyfin.Sync.Utils
  alias StreamystatServer.Repo
  alias StreamystatServer.Jellyfin.Models.Item
  import Ecto.Query

  @doc """
  Maps a Jellyfin item JSON object to a map suitable for database insertion.
  """
  def map_jellyfin_item(jellyfin_item, library_id, server_id) do
    # Get primary image tag if it exists
    primary_image_tag =
      case jellyfin_item["ImageTags"] do
        nil -> nil
        tags when is_map(tags) -> Map.get(tags, "Primary")
        _ -> nil
      end

    primary_image_thumb_tag =
      case jellyfin_item["ImageTags"] do
        nil -> nil
        tags when is_map(tags) -> Map.get(tags, "Thumb")
        _ -> nil
      end

    primary_image_logo_tag =
      case jellyfin_item["ImageTags"] do
        nil -> nil
        tags when is_map(tags) -> Map.get(tags, "Logo")
        _ -> nil
      end

    backdrop_image_tags = jellyfin_item["BackdropImageTags"]

    name =
      case Utils.sanitize_string(jellyfin_item["Name"]) do
        nil ->
          # Try to use a sensible fallback based on other item properties
          cond do
            is_binary(jellyfin_item["OriginalTitle"]) and jellyfin_item["OriginalTitle"] != "" ->
              Utils.sanitize_string(jellyfin_item["OriginalTitle"])

            is_binary(jellyfin_item["SeriesName"]) and jellyfin_item["SeriesName"] != "" ->
              "#{Utils.sanitize_string(jellyfin_item["SeriesName"])} - Unknown Episode"

            is_binary(jellyfin_item["Type"]) ->
              "Untitled #{jellyfin_item["Type"]}"

            true ->
              "Untitled Item"
          end

        "" ->
          # Same fallback logic for empty strings
          cond do
            is_binary(jellyfin_item["OriginalTitle"]) and jellyfin_item["OriginalTitle"] != "" ->
              Utils.sanitize_string(jellyfin_item["OriginalTitle"])

            is_binary(jellyfin_item["SeriesName"]) and jellyfin_item["SeriesName"] != "" ->
              "#{Utils.sanitize_string(jellyfin_item["SeriesName"])} - Unknown Episode"

            is_binary(jellyfin_item["Type"]) ->
              "Untitled #{jellyfin_item["Type"]}"

            true ->
              "Untitled Item"
          end

        valid_name ->
          valid_name
      end

    type = Utils.sanitize_string(jellyfin_item["Type"])

    # Get existing item to check if name changed
    existing_item = Repo.get_by(Item, jellyfin_id: jellyfin_item["Id"], server_id: server_id)

    # Generate new slug if:
    # 1. Item is a movie or series
    # 2. Either there's no existing item or the name has changed
    slug =
      if type in ["Movie", "Series"] do
        if existing_item && existing_item.name == name do
          # Keep existing slug if name hasn't changed
          existing_item.slug
        else
          # Generate new slug from name
          base_slug = generate_base_slug(name)
          generate_unique_slug(base_slug, server_id, existing_item && existing_item.id)
        end
      end

    %{
      jellyfin_id: jellyfin_item["Id"],
      name: name,
      type: type,
      original_title: Utils.sanitize_string(jellyfin_item["OriginalTitle"]),
      etag: Utils.sanitize_string(jellyfin_item["Etag"]),
      date_created: Utils.parse_datetime_to_utc(jellyfin_item["DateCreated"]),
      container: Utils.sanitize_string(jellyfin_item["Container"]),
      sort_name: Utils.sanitize_string(jellyfin_item["SortName"]),
      premiere_date: Utils.parse_datetime_to_utc(jellyfin_item["PremiereDate"]),
      external_urls: jellyfin_item["ExternalUrls"],
      path: Utils.sanitize_string(jellyfin_item["Path"]),
      official_rating: Utils.sanitize_string(jellyfin_item["OfficialRating"]),
      overview: Utils.sanitize_string(jellyfin_item["Overview"]),
      genres: jellyfin_item["Genres"],
      community_rating: Utils.parse_float(jellyfin_item["CommunityRating"]),
      runtime_ticks: jellyfin_item["RunTimeTicks"],
      production_year: jellyfin_item["ProductionYear"],
      is_folder: jellyfin_item["IsFolder"],
      parent_id: jellyfin_item["ParentId"],
      media_type: Utils.sanitize_string(jellyfin_item["MediaType"]),
      width: jellyfin_item["Width"],
      height: jellyfin_item["Height"],
      library_id: library_id,
      server_id: server_id,
      series_name: Utils.sanitize_string(jellyfin_item["SeriesName"]),
      series_id: jellyfin_item["SeriesId"],
      season_id: jellyfin_item["SeasonId"],
      season_name: Utils.sanitize_string(jellyfin_item["SeasonName"]),
      index_number: jellyfin_item["IndexNumber"],
      parent_index_number: jellyfin_item["ParentIndexNumber"],
      primary_image_tag: Utils.sanitize_string(primary_image_tag),
      primary_image_thumb_tag: Utils.sanitize_string(primary_image_thumb_tag),
      primary_image_logo_tag: Utils.sanitize_string(primary_image_logo_tag),
      backdrop_image_tags: backdrop_image_tags,
      image_blur_hashes: jellyfin_item["ImageBlurHashes"],
      video_type: Utils.sanitize_string(jellyfin_item["VideoType"]),
      has_subtitles: jellyfin_item["HasSubtitles"],
      channel_id: jellyfin_item["ChannelId"],
      parent_backdrop_item_id: jellyfin_item["ParentBackdropItemId"],
      parent_backdrop_image_tags: jellyfin_item["ParentBackdropImageTags"],
      parent_thumb_item_id: jellyfin_item["ParentThumbItemId"],
      parent_thumb_image_tag: jellyfin_item["ParentThumbImageTag"],
      location_type: Utils.sanitize_string(jellyfin_item["LocationType"]),
      primary_image_aspect_ratio: Utils.parse_float(jellyfin_item["PrimaryImageAspectRatio"]),
      series_primary_image_tag: Utils.sanitize_string(jellyfin_item["SeriesPrimaryImageTag"]),
      inserted_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second),
      updated_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second),
      slug: slug
    }
  end

  # Private helper functions

  defp generate_base_slug(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/, "-")
    |> String.trim("-")
  end

  defp generate_unique_slug(base_slug, server_id, current_item_id) do
    # Check if this slug already exists for this server
    query =
      from(i in Item,
        where: i.server_id == ^server_id and i.slug == ^base_slug,
        select: i.slug
      )

    # If we're updating an existing item, exclude it from the duplicate check
    query = if current_item_id, do: from(q in query, where: q.id != ^current_item_id), else: query

    existing_slugs = Repo.all(query)

    if Enum.empty?(existing_slugs) do
      # No duplicates, use the base slug
      base_slug
    else
      # Find the highest number suffix
      max_suffix =
        existing_slugs
        |> Enum.map(fn slug ->
          case Regex.run(~r/--(\d+)$/, slug) do
            [_, num] -> String.to_integer(num)
            nil -> 0
          end
        end)
        |> Enum.max(fn -> 0 end)

      # Append the next number
      "#{base_slug}--#{max_suffix + 1}"
    end
  end
end
