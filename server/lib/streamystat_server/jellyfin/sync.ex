defmodule StreamystatServer.Jellyfin.Sync do
  import Ecto.Query
  alias StreamystatServer.Repo
  alias StreamystatServer.Jellyfin.Client
  alias StreamystatServer.Jellyfin.Models.Library
  alias StreamystatServer.Jellyfin.Models.Item
  alias StreamystatServer.Jellyfin.Models.User
  alias StreamystatServer.Activities.Models.Activity

  require Logger

  @item_page_size 500
  @db_batch_size 1000

  @sync_options %{
    max_library_concurrency: 2,
    db_batch_size: 1000,
    api_request_delay_ms: 100,
    item_page_size: 500,
    max_retries: 3,
    retry_initial_delay_ms: 1000,
    adaptive_throttling: true
  }

  def sync_users(server) do
    Logger.info("Starting user sync for server #{server.name}")

    case Client.get_users(server) do
      {:ok, jellyfin_users} ->
        users_data = Enum.map(jellyfin_users, &map_jellyfin_user(&1, server.id))

        # Extract jellyfin_ids from the API response to identify active users
        jellyfin_ids = Enum.map(jellyfin_users, fn user -> user["Id"] end)

        Repo.transaction(fn ->
          # Insert or update existing users
          {updated_count, _} =
            Repo.insert_all(
              StreamystatServer.Jellyfin.Models.User,
              users_data,
              on_conflict: {:replace, [:name]},
              conflict_target: [:jellyfin_id, :server_id]
            )

          # Delete users that no longer exist in Jellyfin
          {deleted_count, _} =
            from(u in User,
                where: u.server_id == ^server.id and u.jellyfin_id not in ^jellyfin_ids)
            |> Repo.delete_all()

          {updated_count, deleted_count}
        end)
        |> case do
          {:ok, {updated_count, deleted_count}} ->
            Logger.info("Successfully synced users for server #{server.name} - Updated: #{updated_count}, Deleted: #{deleted_count}")
            {:ok, %{updated: updated_count, deleted: deleted_count}}

          {:error, reason} ->
            Logger.error("Failed to sync users for server #{server.name}: #{inspect(reason)}")
            {:error, reason}
        end

      {:error, reason} ->
        Logger.error("Failed to sync users for server #{server.name}: #{inspect(reason)}")
        {:error, reason}
    end
  end

  def sync_libraries(server) do
    Logger.info("Starting library sync for server #{server.name}")

    case get_libraries_to_sync(server) do
      {:ok, jellyfin_libraries} ->
        libraries = Enum.map(jellyfin_libraries, &map_jellyfin_library(&1, server.id))

        result =
          Enum.reduce(libraries, {0, []}, fn library, {count, errors} ->
            case Repo.insert(Library.changeset(%Library{}, library),
                   on_conflict: {:replace_all_except, [:id]},
                   conflict_target: [:jellyfin_id, :server_id]
                 ) do
              {:ok, _} ->
                {count + 1, errors}

              {:error, changeset} ->
                Logger.warning("Error inserting library: #{inspect(changeset.errors)}")
                {count, [changeset.errors | errors]}
            end
          end)

        case result do
          {count, []} ->
            Logger.info("Synced #{count} libraries")
            {:ok, count}

          {count, errors} ->
            Logger.warning("Synced #{count} libraries with #{length(errors)} errors")
            Logger.warning("Errors: #{inspect(errors)}")
            {:partial, count, errors}
        end

      {:error, reason} ->
        Logger.error("Failed to sync libraries: #{inspect(reason)}")
        {:error, reason}
    end
  end

  def sync_items(server, user_options \\ %{}) do
    start_time = System.monotonic_time(:millisecond)
    options = Map.merge(@sync_options, user_options)
    metrics = %{
      libraries_processed: 0,
      items_processed: 0,
      errors: [],
      api_requests: 0,
      database_operations: 0,
      start_time: DateTime.utc_now()
    }

    {:ok, metrics_agent} = Agent.start_link(fn -> metrics end)

    Logger.info("Starting item sync for server #{server.name}")

    result = case get_libraries_to_sync(server) do
      {:ok, libraries} ->
        Logger.info("Syncing #{length(libraries)} libraries for server #{server.name}")

        max_concurrency = options.max_library_concurrency

        results =
          Task.async_stream(
            libraries,
            fn library ->
              update_metrics(metrics_agent, %{api_requests: 1})
              result = sync_library_items(server, library["Id"], metrics_agent, options)
              update_metrics(metrics_agent, %{libraries_processed: 1})
              result
            end,
            max_concurrency: max_concurrency,
            timeout: 600_000
          )
          |> Enum.map(fn {:ok, result} -> result end)

        total_count = Enum.sum(Enum.map(results, fn {_, count, _} -> count end))
        total_errors = Enum.flat_map(results, fn {_, _, errors} -> errors end)

        update_metrics(metrics_agent, %{items_processed: total_count, errors: total_errors})

        case total_errors do
          [] ->
            Logger.info("Synced #{total_count} items across all libraries")
            {:ok, total_count}

          _ ->
            Logger.warning(
              "Synced #{total_count} items with #{length(total_errors)} errors across all libraries"
            )

            Logger.warning("Errors: #{inspect(total_errors)}")
            {:partial, total_count, total_errors}
        end

      {:error, reason} ->
        update_metrics(metrics_agent, %{errors: [reason]})
        Logger.error("Failed to fetch libraries: #{inspect(reason)}")
        {:error, reason}
    end

    end_time = System.monotonic_time(:millisecond)
    duration_ms = end_time - start_time

    final_metrics = Agent.get(metrics_agent, & &1)
    Agent.stop(metrics_agent)

    Logger.info("""
    Sync completed for server #{server.name}
    Duration: #{duration_ms / 1000} seconds
    Libraries processed: #{final_metrics.libraries_processed}
    Items processed: #{final_metrics.items_processed}
    API requests: #{final_metrics.api_requests}
    Database operations: #{final_metrics.database_operations}
    Errors: #{length(final_metrics.errors)}
    """)

    {result, final_metrics}
  end

  # New function to get libraries to sync based on enabled_libraries
  defp get_libraries_to_sync(server) do
    case Client.get_libraries(server) do
      {:ok, all_libraries} ->
        # If enabled_libraries is empty or nil, sync all libraries
        libraries_to_sync = if Enum.empty?(server.enabled_libraries || []) do
          all_libraries
        else
          # Otherwise, only sync enabled libraries
          Enum.filter(all_libraries, fn library ->
            Enum.member?(server.enabled_libraries, library["Id"])
          end)
        end

        {:ok, libraries_to_sync}

      {:error, reason} ->
        {:error, reason}
    end
  end

  def sync_activities(server, user_options \\ %{}) do
    start_time = System.monotonic_time(:millisecond)
    options = Map.merge(@sync_options, %{batch_size: 5000})
    options = Map.merge(options, user_options)
    metrics = %{
      activities_processed: 0,
      activities_inserted: 0,
      api_requests: 0,
      database_operations: 0,
      errors: [],
      start_time: DateTime.utc_now()
    }

    {:ok, metrics_agent} = Agent.start_link(fn -> metrics end)
    Logger.info("Starting full activity sync for server #{server.name}")

    result =
      Stream.resource(
        fn -> {0, 0} end,
        fn {start_index, total_synced} ->
          update_metrics(metrics_agent, %{api_requests: 1})
          case Client.get_activities(server, start_index, options.batch_size) do
            {:ok, []} ->
              {:halt, {start_index, total_synced}}
            {:ok, activities} ->
              batch_size = length(activities)
              update_metrics(metrics_agent, %{activities_processed: batch_size})
              {[{activities, start_index}],
               {start_index + options.batch_size, total_synced + batch_size}}
            {:error, reason} ->
              Logger.error("Failed to fetch activities: #{inspect(reason)}")
              update_metrics(metrics_agent, %{errors: [reason]})
              {:halt, {start_index, total_synced}}
          end
        end,
        fn _ -> :ok end
      )
      |> Stream.map(fn {activities, _index} ->
        new_activities = Enum.map(activities, &map_activity(&1, server))
        update_metrics(metrics_agent, %{database_operations: 1})
        try do
          {inserted, _} = Repo.insert_all(Activity, new_activities, on_conflict: :nothing)
          update_metrics(metrics_agent, %{activities_inserted: inserted})
          {:ok, inserted}
        rescue
          e ->
            Logger.error("Failed to insert activities: #{inspect(e)}")
            update_metrics(metrics_agent, %{errors: [inspect(e)]})
            {:error, inspect(e)}
        end
      end)
      |> Enum.reduce(
        {:ok, 0, []},
        fn
          {:ok, count}, {:ok, total, errors} ->
            {:ok, total + count, errors}
          {:error, error}, {_, total, errors} ->
            {:error, total, [error | errors]}
        end
      )

    end_time = System.monotonic_time(:millisecond)
    duration_ms = end_time - start_time

    final_metrics = Agent.get(metrics_agent, & &1)
    Agent.stop(metrics_agent)

    Logger.info("""
    Activity sync completed for server #{server.name}
    Duration: #{duration_ms / 1000} seconds
    Activities processed: #{final_metrics.activities_processed}
    Activities inserted: #{final_metrics.activities_inserted}
    API requests: #{final_metrics.api_requests}
    Database operations: #{final_metrics.database_operations}
    Errors: #{length(final_metrics.errors)}
    """)

    case result do
      {:ok, count, []} ->
        Logger.info("Successfully synced #{count} activities for server #{server.name}")
        {{:ok, count}, final_metrics}

      {:ok, count, errors} ->
        Logger.warning("Synced #{count} activities with #{length(errors)} errors")
        {{:partial, count, errors}, final_metrics}

      {:error, _, errors} ->
        Logger.error("Failed to sync activities for server #{server.name}")
        {{:error, errors}, final_metrics}
    end
  end

  def sync_recent_activities(server) do

    start_time = System.monotonic_time(:millisecond)


    metrics = %{
      activities_processed: 0,
      activities_inserted: 0,
      api_requests: 1,
      database_operations: 0,
      errors: []
    }

    Logger.info("Starting recent activity sync for server #{server.name}")

    {result, updated_metrics} =
        case Client.get_activities(server, 0, 25) do
        {:ok, activities} ->
          metrics = Map.put(metrics, :activities_processed, length(activities))
          new_activities = Enum.map(activities, &map_activity(&1, server))
          metrics = Map.put(metrics, :database_operations, 1)

          try do
            {inserted, _} = Repo.insert_all(Activity, new_activities, on_conflict: :nothing)

            metrics = Map.put(metrics, :activities_inserted, inserted)
            {{:ok, inserted}, metrics}
          rescue
            e ->
              Logger.error("Error inserting activities: #{inspect(e)}")
              metrics = Map.update(metrics, :errors, [inspect(e)], fn errors -> [inspect(e) | errors] end)
              {{:error, inspect(e)}, metrics}
          end

        {:error, reason} ->
          metrics = Map.update(metrics, :errors, [reason], fn errors -> [reason | errors] end)
          {{:error, reason}, metrics}
      end


    end_time = System.monotonic_time(:millisecond)
    duration_ms = end_time - start_time


    Logger.info("""
    Recent activity sync completed for server #{server.name}
    Duration: #{duration_ms / 1000} seconds
    Activities processed: #{updated_metrics.activities_processed}
    Activities inserted: #{updated_metrics.activities_inserted}
    API requests: #{updated_metrics.api_requests}
    Database operations: #{updated_metrics.database_operations}
    Errors: #{length(updated_metrics.errors)}
    """)

    Logger.info("Finished recent activity sync for server #{server.name}")
    {result, updated_metrics}
  end


  defp sanitize_string(nil), do: nil

  defp sanitize_string(str) when is_binary(str) do
    str

    |> String.replace(<<0>>, "")

    |> String.replace(~r/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/, "")
  end

  defp sanitize_string(other), do: other

  defp sync_library_items(server, jellyfin_library_id, metrics_agent, options) do
    Logger.info("Starting item sync for Jellyfin library #{jellyfin_library_id}")

    with {:ok, library} <- get_library_by_jellyfin_id(jellyfin_library_id, server.id) do

      try do

        batch_size = Map.get(options, :item_page_size, @item_page_size)
        db_batch_size = Map.get(options, :db_batch_size, @db_batch_size)

        {total_count, errors} =
          Stream.resource(

            fn -> {0, 0, []} end,


            fn {start_index, total_fetched, acc_errors} ->

              if metrics_agent, do: update_metrics(metrics_agent, %{api_requests: 1})

              case Client.get_items_page(server, jellyfin_library_id, start_index, batch_size) do
                {:ok, {items, total_count}} ->
                  if items == [] do

                    {:halt, {total_fetched, acc_errors}}
                  else

                    if metrics_agent, do: update_metrics(metrics_agent, %{items_processed: length(items)})


                    {[{items, total_count}], {start_index + batch_size, total_fetched + length(items), acc_errors}}
                  end

                {:error, reason} ->
                  Logger.error("Error fetching items: #{inspect(reason)}")

                  if metrics_agent, do: update_metrics(metrics_agent, %{errors: [reason]})
                  {:halt, {total_fetched, [reason | acc_errors]}}
              end
            end,


            fn _acc -> :ok end
          )
          |> Stream.flat_map(fn {items, _} ->

            items
            |> Enum.map(&map_jellyfin_item(&1, library.id, server.id))
          end)
          |> Stream.chunk_every(db_batch_size)
          |> Stream.map(fn batch ->
            if metrics_agent, do: update_metrics(metrics_agent, %{database_operations: 1})

            case Repo.insert_all(
                   Item,
                   batch,
                   on_conflict: {:replace_all_except, [:id]},
                   conflict_target: [:jellyfin_id, :library_id]
                 ) do
              {count, nil} -> {count, []}
              {count, error} -> {count, [error]}
            end
          end)
          |> Enum.reduce({0, []}, fn {count, batch_errors}, {total, all_errors} ->
            {total + count, all_errors ++ batch_errors}
          end)


        case errors do
          [] ->
            Logger.info("Synced #{total_count} items for library #{library.name}")
            {:ok, total_count, []}

          _ ->
            Logger.warning(
              "Synced #{total_count} items for library #{library.name} with #{length(errors)} errors"
            )

            {:partial, total_count, errors}
        end
      rescue
        e ->
          if metrics_agent, do: update_metrics(metrics_agent, %{errors: [inspect(e)]})
          Logger.error("Error syncing items for library #{library.name}: #{inspect(e)}")
          {:error, 0, [inspect(e)]}
      end
    else
      {:error, :library_not_found} ->
        if metrics_agent, do: update_metrics(metrics_agent, %{errors: ["Library not found"]})
        Logger.error(
          "Library with Jellyfin ID #{jellyfin_library_id} not found for server #{server.id}"
        )
        {:error, 0, ["Library not found"]}

      {:error, reason} ->
        if metrics_agent, do: update_metrics(metrics_agent, %{errors: [inspect(reason)]})
        Logger.error(
          "Failed to sync items for Jellyfin library #{jellyfin_library_id}: #{inspect(reason)}"
        )
        {:error, 0, [inspect(reason)]}
    end
  end


  defp update_metrics(nil, _updates), do: :ok
  defp update_metrics(agent, updates) do
    Agent.update(agent, fn metrics ->
      Map.merge(metrics, updates, fn _k, v1, v2 ->

        if is_integer(v1) and is_integer(v2) do
          v1 + v2
        else

          if is_list(v1) and is_list(v2) do
            v1 ++ v2
          else

            v2
          end
        end
      end)
    end)
  end

  defp map_activity(activity, server) do
    %{
      jellyfin_id: activity["Id"],
      name: activity["Name"],
      short_overview: activity["ShortOverview"],
      type: activity["Type"],
      date: parse_datetime_to_utc(activity["Date"]),
      user_id: get_user_id(server, activity["UserId"]),
      server_id: server.id,
      severity: activity["Severity"],
      inserted_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second),
      updated_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
    }
  end

  defp get_user_id(server, jellyfin_user_id) do
    case jellyfin_user_id do
      "00000000000000000000000000000000" ->
        nil

      nil ->
        nil

      id ->
        case Repo.get_by(User, jellyfin_id: id, server_id: server.id) do
          nil -> nil
          user -> user.id
        end
    end
  end

  defp parse_datetime_to_utc(nil), do: nil
  defp parse_datetime_to_utc(""), do: nil

  defp parse_datetime_to_utc(datetime_string) when is_binary(datetime_string) do
    case DateTime.from_iso8601(datetime_string) do
      {:ok, datetime, _offset} ->
        DateTime.truncate(datetime, :second)

      {:error, _} ->
        case NaiveDateTime.from_iso8601(datetime_string) do
          {:ok, naive_datetime} ->
            naive_datetime
            |> DateTime.from_naive!("Etc/UTC")
            |> DateTime.truncate(:second)

          {:error, _} ->
            Logger.warning("Failed to parse datetime: #{datetime_string}")
            nil
        end
    end
  end

  defp parse_datetime_to_utc(_), do: nil

  defp get_library_by_jellyfin_id(jellyfin_library_id, server_id) do
    case Repo.get_by(Library, jellyfin_id: jellyfin_library_id, server_id: server_id) do
      nil -> {:error, :library_not_found}
      library -> {:ok, library}
    end
  end

  defp map_jellyfin_item(jellyfin_item, library_id, server_id) do
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

    name = case sanitize_string(jellyfin_item["Name"]) do
      nil ->
        # Try to use a sensible fallback based on other item properties
        cond do
          is_binary(jellyfin_item["OriginalTitle"]) and jellyfin_item["OriginalTitle"] != "" ->
            sanitize_string(jellyfin_item["OriginalTitle"])
          is_binary(jellyfin_item["SeriesName"]) and jellyfin_item["SeriesName"] != "" ->
            "#{sanitize_string(jellyfin_item["SeriesName"])} - Unknown Episode"
          is_binary(jellyfin_item["Type"]) ->
            "Untitled #{jellyfin_item["Type"]}"
          true ->
            "Untitled Item"
        end
      "" ->
        # Same fallback logic for empty strings
        cond do
          is_binary(jellyfin_item["OriginalTitle"]) and jellyfin_item["OriginalTitle"] != "" ->
            sanitize_string(jellyfin_item["OriginalTitle"])
          is_binary(jellyfin_item["SeriesName"]) and jellyfin_item["SeriesName"] != "" ->
            "#{sanitize_string(jellyfin_item["SeriesName"])} - Unknown Episode"
          is_binary(jellyfin_item["Type"]) ->
            "Untitled #{jellyfin_item["Type"]}"
          true ->
            "Untitled Item"
        end
      valid_name ->
        valid_name
    end

    %{
      jellyfin_id: jellyfin_item["Id"],
      name: sanitize_string(jellyfin_item["Name"]),
      type: sanitize_string(jellyfin_item["Type"]),
      original_title: sanitize_string(jellyfin_item["OriginalTitle"]),
      etag: sanitize_string(jellyfin_item["Etag"]),
      date_created: parse_datetime_to_utc(jellyfin_item["DateCreated"]),
      container: sanitize_string(jellyfin_item["Container"]),
      sort_name: sanitize_string(jellyfin_item["SortName"]),
      premiere_date: parse_datetime_to_utc(jellyfin_item["PremiereDate"]),
      external_urls: jellyfin_item["ExternalUrls"],
      path: sanitize_string(jellyfin_item["Path"]),
      official_rating: sanitize_string(jellyfin_item["OfficialRating"]),
      overview: sanitize_string(jellyfin_item["Overview"]),
      genres: jellyfin_item["Genres"],
      community_rating: parse_float(jellyfin_item["CommunityRating"]),
      runtime_ticks: jellyfin_item["RunTimeTicks"],
      production_year: jellyfin_item["ProductionYear"],
      is_folder: jellyfin_item["IsFolder"],
      parent_id: jellyfin_item["ParentId"],
      media_type: sanitize_string(jellyfin_item["MediaType"]),
      width: jellyfin_item["Width"],
      height: jellyfin_item["Height"],
      library_id: library_id,
      server_id: server_id,
      series_name: sanitize_string(jellyfin_item["SeriesName"]),
      series_id: jellyfin_item["SeriesId"],
      season_id: jellyfin_item["SeasonId"],
      season_name: sanitize_string(jellyfin_item["SeasonName"]),
      index_number: jellyfin_item["IndexNumber"],
      parent_index_number: jellyfin_item["ParentIndexNumber"],
      primary_image_tag: sanitize_string(primary_image_tag),
      primary_image_thumb_tag: sanitize_string(primary_image_thumb_tag),
      primary_image_logo_tag: sanitize_string(primary_image_logo_tag),
      backdrop_image_tags: backdrop_image_tags,
      image_blur_hashes: jellyfin_item["ImageBlurHashes"],
      video_type: sanitize_string(jellyfin_item["VideoType"]),
      has_subtitles: jellyfin_item["HasSubtitles"],
      channel_id: jellyfin_item["ChannelId"],
      parent_backdrop_item_id: jellyfin_item["ParentBackdropItemId"],
      parent_backdrop_image_tags: jellyfin_item["ParentBackdropImageTags"],
      parent_thumb_item_id: jellyfin_item["ParentThumbItemId"],
      parent_thumb_image_tag: jellyfin_item["ParentThumbImageTag"],
      location_type: sanitize_string(jellyfin_item["LocationType"]),
      primary_image_aspect_ratio: parse_float(jellyfin_item["PrimaryImageAspectRatio"]),
      series_primary_image_tag: sanitize_string(jellyfin_item["SeriesPrimaryImageTag"]),
      inserted_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second),
      updated_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
    }
  end

  defp parse_float(nil), do: nil

  defp parse_float(string) when is_binary(string) do
    case Float.parse(string) do
      {float, _} -> float
      :error -> nil
    end
  end

  defp parse_float(number) when is_integer(number), do: number / 1
  defp parse_float(number) when is_float(number), do: number
  defp parse_float(_), do: nil

  defp map_jellyfin_user(user_data, server_id) do
    %{
      jellyfin_id: user_data["Id"],
      name: user_data["Name"],
      server_id: server_id,
      has_password: user_data["HasPassword"],
      has_configured_password: user_data["HasConfiguredPassword"],
      has_configured_easy_password: user_data["HasConfiguredEasyPassword"],
      enable_auto_login: user_data["EnableAutoLogin"],
      last_login_date: parse_datetime_to_utc(user_data["LastLoginDate"]),
      last_activity_date: parse_datetime_to_utc(user_data["LastActivityDate"]),
      is_administrator: user_data["Policy"]["IsAdministrator"],
      is_hidden: user_data["Policy"]["IsHidden"],
      is_disabled: user_data["Policy"]["IsDisabled"],
      enable_user_preference_access: user_data["Policy"]["EnableUserPreferenceAccess"],
      enable_remote_control_of_other_users:
        user_data["Policy"]["EnableRemoteControlOfOtherUsers"],
      enable_shared_device_control: user_data["Policy"]["EnableSharedDeviceControl"],
      enable_remote_access: user_data["Policy"]["EnableRemoteAccess"],
      enable_live_tv_management: user_data["Policy"]["EnableLiveTvManagement"],
      enable_live_tv_access: user_data["Policy"]["EnableLiveTvAccess"],
      enable_media_playback: user_data["Policy"]["EnableMediaPlayback"],
      enable_audio_playback_transcoding: user_data["Policy"]["EnableAudioPlaybackTranscoding"],
      enable_video_playback_transcoding: user_data["Policy"]["EnableVideoPlaybackTranscoding"],
      enable_playback_remuxing: user_data["Policy"]["EnablePlaybackRemuxing"],
      enable_content_deletion: user_data["Policy"]["EnableContentDeletion"],
      enable_content_downloading: user_data["Policy"]["EnableContentDownloading"],
      enable_sync_transcoding: user_data["Policy"]["EnableSyncTranscoding"],
      enable_media_conversion: user_data["Policy"]["EnableMediaConversion"],
      enable_all_devices: user_data["Policy"]["EnableAllDevices"],
      enable_all_channels: user_data["Policy"]["EnableAllChannels"],
      enable_all_folders: user_data["Policy"]["EnableAllFolders"],
      enable_public_sharing: user_data["Policy"]["EnablePublicSharing"],
      invalid_login_attempt_count: user_data["Policy"]["InvalidLoginAttemptCount"],
      login_attempts_before_lockout: user_data["Policy"]["LoginAttemptsBeforeLockout"],
      max_active_sessions: user_data["Policy"]["MaxActiveSessions"],
      remote_client_bitrate_limit: user_data["Policy"]["RemoteClientBitrateLimit"],
      authentication_provider_id: user_data["Policy"]["AuthenticationProviderId"],
      password_reset_provider_id: user_data["Policy"]["PasswordResetProviderId"],
      sync_play_access: user_data["Policy"]["SyncPlayAccess"],
      inserted_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second),
      updated_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
    }
  end

  defp map_jellyfin_library(jellyfin_library, server_id) do
    type = jellyfin_library["CollectionType"] || "unknown"

    sanitized_type =
      case sanitize_string(type) do
        nil -> "unknown"
        sanitized -> sanitized
      end

    %{
      jellyfin_id: jellyfin_library["Id"],
      name: sanitize_string(jellyfin_library["Name"]),
      type: sanitized_type,
      server_id: server_id,
      inserted_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second),
      updated_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
    }
  end
end
