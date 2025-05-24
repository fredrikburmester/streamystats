defmodule StreamystatServer.Contexts.Users do
  import Ecto.Query, warn: false
  alias StreamystatServer.Repo
  alias StreamystatServer.Jellyfin.Models.User
  alias StreamystatServer.Jellyfin.Models.Item
  alias StreamystatServer.Sessions.Models.PlaybackSession
  alias Decimal
  require Logger

  def get_users(server_id) do
    Repo.all(from(u in User, where: u.server_id == ^server_id))
  end

  @doc """
  Creates an initial user record from Jellyfin user data.
  This function is called when a user logs in for the first time
  before being synced through the regular sync process.
  """
  def create_initial_user(server_id, jellyfin_user) do
    Logger.info(
      "Jellyfin user data: #{inspect(jellyfin_user, limit: :infinity, printable_limit: 500)}"
    )

    policy = Map.get(jellyfin_user, "Policy", %{})

    # Create a user record with all fields set
    user_params = %{
      jellyfin_id: jellyfin_user["Id"],
      name: jellyfin_user["Name"],
      server_id: server_id,
      last_login: DateTime.utc_now(),
      total_watch_time: 0,
      play_count: 0,
      has_password: jellyfin_user["HasPassword"],
      has_configured_password: jellyfin_user["HasConfiguredPassword"],
      has_configured_easy_password: jellyfin_user["HasConfiguredEasyPassword"],
      enable_auto_login: jellyfin_user["EnableAutoLogin"],
      last_login_date: parse_jellyfin_datetime(jellyfin_user["LastLoginDate"]),
      last_activity_date: parse_jellyfin_datetime(jellyfin_user["LastActivityDate"]),
      is_administrator: policy["IsAdministrator"],
      is_hidden: policy["IsHidden"],
      is_disabled: policy["IsDisabled"],
      enable_user_preference_access: policy["EnableUserPreferenceAccess"],
      enable_remote_control_of_other_users: policy["EnableRemoteControlOfOtherUsers"],
      enable_shared_device_control: policy["EnableSharedDeviceControl"],
      enable_remote_access: policy["EnableRemoteAccess"],
      enable_live_tv_management: policy["EnableLiveTvManagement"],
      enable_live_tv_access: policy["EnableLiveTvAccess"],
      enable_media_playback: policy["EnableMediaPlayback"],
      enable_audio_playback_transcoding: policy["EnableAudioPlaybackTranscoding"],
      enable_video_playback_transcoding: policy["EnableVideoPlaybackTranscoding"],
      enable_playback_remuxing: policy["EnablePlaybackRemuxing"],
      enable_content_deletion: policy["EnableContentDeletion"],
      enable_content_downloading: policy["EnableContentDownloading"],
      enable_sync_transcoding: policy["EnableSyncTranscoding"],
      enable_media_conversion: policy["EnableMediaConversion"],
      enable_all_devices: policy["EnableAllDevices"],
      enable_all_channels: policy["EnableAllChannels"],
      enable_all_folders: policy["EnableAllFolders"],
      enable_public_sharing: policy["EnablePublicSharing"],
      invalid_login_attempt_count: policy["InvalidLoginAttemptCount"],
      login_attempts_before_lockout: policy["LoginAttemptsBeforeLockout"],
      max_active_sessions: policy["MaxActiveSessions"],
      remote_client_bitrate_limit: policy["RemoteClientBitrateLimit"],
      authentication_provider_id: policy["AuthenticationProviderId"],
      password_reset_provider_id: policy["PasswordResetProviderId"],
      sync_play_access: policy["SyncPlayAccess"],
      # primary_image_tag: jellyfin_user["PrimaryImageTag"]
    }

    Logger.debug("User params with server_id #{inspect(server_id)}: #{inspect(user_params)}")

    %User{}
    |> User.changeset(user_params)
    |> Repo.insert()
    |> case do
      {:ok, user} ->
        Logger.info(
          "Successfully created initial user: #{user.name} (#{user.jellyfin_id}) for server_id: #{inspect(server_id)}"
        )

        {:ok, user}

      {:error, changeset} ->
        Logger.error(
          "Failed to create initial user for server_id #{inspect(server_id)}: #{inspect(changeset.errors)}"
        )

        {:error, changeset}
    end
  end

  defp parse_jellyfin_datetime(nil), do: nil

  defp parse_jellyfin_datetime(date_string) when is_binary(date_string) do
    case DateTime.from_iso8601(date_string) do
      {:ok, datetime, _} -> datetime
      # Handle potential parsing errors
      _ -> nil
    end
  end

  def get_user(server_id, user_id) do
    # First, try to find the user by jellyfin_id directly
    case Repo.get_by(User, jellyfin_id: user_id, server_id: server_id) do
      %User{} = user ->
        user

      nil ->
        # Try to find by name as a last resort
        Logger.debug("Trying to find user by name: #{inspect(user_id)}")
        Repo.get_by(User, name: user_id, server_id: server_id)
    end
  end

  def get_user_watch_stats(server_id, user_jellyfin_id) do
    # Get the user to verify it exists and get the user's jellyfin_id if passed by name
    user = get_user(server_id, user_jellyfin_id)
    user_jellyfin_id = user && user.jellyfin_id

    if user_jellyfin_id do
      # Get total watch time
      total_watch_time =
        from(ps in PlaybackSession,
          where: ps.server_id == ^server_id and ps.user_jellyfin_id == ^user_jellyfin_id,
          select: sum(ps.play_duration)
        )
        |> Repo.one() || 0

      # Get total distinct items watched
      items_watched =
        from(ps in PlaybackSession,
          where: ps.server_id == ^server_id and ps.user_jellyfin_id == ^user_jellyfin_id,
          select: count(ps.item_jellyfin_id, :distinct)
        )
        |> Repo.one() || 0

      # Get completed items
      completed_items =
        from(ps in PlaybackSession,
          where: ps.server_id == ^server_id and ps.user_jellyfin_id == ^user_jellyfin_id and ps.completed == true,
          select: count()
        )
        |> Repo.one() || 0

      # --- Calculate Average Watch Time Per Day using Subquery ---
      daily_sums_query =
        from(ps in PlaybackSession,
          where: ps.server_id == ^server_id and ps.user_jellyfin_id == ^user_jellyfin_id,
          group_by: fragment("date(?)", ps.start_time),
          select: %{
            daily_sum: sum(ps.play_duration)
          },
          having: count(ps.id) > 0
        )

      avg_watch_time_per_day =
        from(ds in subquery(daily_sums_query),
          select: avg(ds.daily_sum)
        )
        |> Repo.one() || Decimal.new(0)

      avg_watch_time_per_day_int =
        avg_watch_time_per_day
        |> Decimal.to_float()
        |> Float.round()
        |> trunc()

      # --- End Subquery Calculation ---

      # +++ Calculate Total Plays (Number of Sessions) +++
      total_plays =
        from(ps in PlaybackSession,
          where: ps.server_id == ^server_id and ps.user_jellyfin_id == ^user_jellyfin_id,
          # Count all playback session rows for the user
          select: count(ps.id)
        )
        |> Repo.one() || 0

      # +++ End Total Plays Calculation +++

      %{
        total_watch_time: total_watch_time,
        items_watched: items_watched,
        completed_items: completed_items,
        avg_watch_time_per_day: avg_watch_time_per_day_int,
        total_plays: total_plays
      }
    else
      # User not found, return empty stats
      %{
        total_watch_time: 0,
        items_watched: 0,
        completed_items: 0,
        avg_watch_time_per_day: 0,
        total_plays: 0
      }
    end
  end

  def get_user_watch_time_per_day(server_id, user_jellyfin_id) do
    # Get the user to verify it exists and get the user's jellyfin_id if passed by name
    user = get_user(server_id, user_jellyfin_id)
    user_jellyfin_id = user && user.jellyfin_id

    if user_jellyfin_id do
      thirty_days_ago = Date.add(Date.utc_today(), -30)

      from(ps in PlaybackSession,
        where:
          ps.server_id == ^server_id and ps.user_jellyfin_id == ^user_jellyfin_id and
            fragment("date(?)", ps.start_time) >= ^thirty_days_ago,
        group_by: fragment("date(?)", ps.start_time),
        select: %{
          date: fragment("date(?)", ps.start_time),
          total_duration: sum(ps.play_duration)
        },
        order_by: fragment("date(?)", ps.start_time)
      )
      |> Repo.all()
      |> Enum.map(fn %{date: date, total_duration: duration} ->
        %{
          date: Date.to_iso8601(date),
          total_duration: duration
        }
      end)
    else
      []
    end
  end

  def get_user_genre_watch_time(server_id, user_jellyfin_id) do
    # Get the user to verify it exists and get the user's jellyfin_id if passed by name
    user = get_user(server_id, user_jellyfin_id)
    user_jellyfin_id = user && user.jellyfin_id

    if user_jellyfin_id do
      # Join with items to get genre info
      from(ps in PlaybackSession,
        join: i in StreamystatServer.Jellyfin.Models.Item,
        on: ps.item_jellyfin_id == i.jellyfin_id and ps.server_id == i.server_id,
        where: ps.server_id == ^server_id and ps.user_jellyfin_id == ^user_jellyfin_id,
        group_by: i.genres,
        select: %{
          genre: i.genres,
          total_duration: sum(ps.play_duration)
        },
        order_by: [desc: sum(ps.play_duration)],
        limit: 5
      )
      |> Repo.all()
      |> Enum.filter(fn %{genre: genre} -> genre && genre != [] end)
      |> Enum.flat_map(fn %{genre: genres, total_duration: duration} ->
        Enum.map(genres, fn genre -> %{genre: genre, total_duration: duration} end)
      end)
      |> Enum.group_by(fn %{genre: genre} -> genre end)
      |> Enum.map(fn {genre, entries} ->
        total = Enum.reduce(entries, 0, fn %{total_duration: duration}, acc -> acc + duration end)
        %{genre: genre, watch_time: total}
      end)
      |> Enum.sort_by(fn %{watch_time: duration} -> duration end, :desc)
      |> Enum.take(5)
    else
      []
    end
  end

  def get_user_longest_streak(user_jellyfin_id) do
    # Convert sessions to days watched
    days_watched =
      from(ps in PlaybackSession,
        where: ps.user_jellyfin_id == ^user_jellyfin_id,
        distinct: fragment("date(?)", ps.start_time),
        select: fragment("date(?)", ps.start_time),
        order_by: fragment("date(?)", ps.start_time)
      )
      |> Repo.all()

    # Calculate longest streak
    calculate_longest_streak(days_watched)
  end

  def get_user_watch_history(server_id, user_jellyfin_id, params \\ %{}) do
    # Base query for a specific user
    base_query =
      from(ps in PlaybackSession,
        join: i in Item,
        on: ps.item_jellyfin_id == i.jellyfin_id,
        join: u in User,
        on: ps.user_jellyfin_id == u.jellyfin_id,
        where: ps.server_id == ^server_id and ps.user_jellyfin_id == ^user_jellyfin_id,
        order_by: [desc: ps.start_time],
        select: %{
          id: ps.id,
          date_created: ps.start_time,
          item_id: ps.item_jellyfin_id,
          item_type: i.type,
          item_name: ps.item_name,
          client_name: ps.client_name,
          device_name: ps.device_name,
          play_method: ps.play_method,
          play_duration: ps.play_duration,
          percent_complete: coalesce(ps.percent_complete, 0),
          completed: coalesce(ps.completed, false),
          series_name: ps.series_name,
          season_name: i.season_name,
          index_number: i.index_number,
          primary_image_tag: i.primary_image_tag,
          backdrop_image_tags: i.backdrop_image_tags,
          image_blur_hashes: i.image_blur_hashes,
          parent_backdrop_item_id: i.parent_backdrop_item_id,
          parent_backdrop_image_tags: i.parent_backdrop_image_tags,
          parent_thumb_item_id: i.parent_thumb_item_id,
          parent_thumb_image_tag: i.parent_thumb_image_tag,
          primary_image_aspect_ratio: i.primary_image_aspect_ratio,
          series_primary_image_tag: i.series_primary_image_tag,
          primary_image_thumb_tag: i.primary_image_thumb_tag,
          primary_image_logo_tag: i.primary_image_logo_tag,
          user_jellyfin_id: u.jellyfin_id,
          user_name: u.name,
          transcoding_audio_codec: ps.transcoding_audio_codec,
          transcoding_video_codec: ps.transcoding_video_codec,
          transcoding_container: ps.transcoding_container,
          transcoding_is_video_direct: ps.transcoding_is_video_direct,
          transcoding_is_audio_direct: ps.transcoding_is_audio_direct,
          transcoding_bitrate: ps.transcoding_bitrate,
          transcoding_completion_percentage: ps.transcoding_completion_percentage,
          transcoding_width: ps.transcoding_width,
          transcoding_height: ps.transcoding_height,
          transcoding_audio_channels: ps.transcoding_audio_channels,
          transcoding_hardware_acceleration_type: ps.transcoding_hardware_acceleration_type,
          transcoding_reasons: ps.transcoding_reasons,
          remote_end_point: ps.remote_end_point
        }
      )

    # Count total items for pagination metadata
    total_items_query =
      from(ps in PlaybackSession,
        where: ps.server_id == ^server_id and ps.user_jellyfin_id == ^user_jellyfin_id,
        select: count(ps.id)
      )

    total_items = Repo.one(total_items_query)

    # Add pagination
    page = params["page"] || "1"
    per_page = params["per_page"] || "20"
    {page, _} = Integer.parse(page)
    {per_page, _} = Integer.parse(per_page)

    # Calculate total pages
    total_pages = ceil(total_items / per_page)

    paginated_query =
      base_query
      |> limit(^per_page)
      |> offset((^page - 1) * ^per_page)

    # Return the watch history data with pagination metadata
    %{
      page: page,
      per_page: per_page,
      total_items: total_items,
      total_pages: total_pages,
      data: Repo.all(paginated_query)
    }
  end

  # Helper to calculate streak from list of dates
  defp calculate_longest_streak([]), do: 0

  defp calculate_longest_streak(dates) do
    dates
    |> Enum.reduce({0, 0, nil}, fn date, {max_streak, current_streak, prev_date} ->
      case prev_date do
        nil ->
          {1, 1, date}

        _ ->
          if Date.diff(date, prev_date) == 1 do
            new_streak = current_streak + 1
            {max(max_streak, new_streak), new_streak, date}
          else
            {max(max_streak, current_streak), 1, date}
          end
      end
    end)
    |> then(fn {max_streak, current_streak, _} ->
      max(max_streak, current_streak)
    end)
  end

  # Returns a list of %{day_of_week: 1..7, total_duration: int} for the user, for the last 30 days
  def get_user_watch_time_per_weekday(server_id, user_jellyfin_id) do
    user = get_user(server_id, user_jellyfin_id)
    user_jellyfin_id = user && user.jellyfin_id

    if user_jellyfin_id do
      thirty_days_ago = Date.add(Date.utc_today(), -30)

      from(ps in PlaybackSession,
        where:
          ps.server_id == ^server_id and ps.user_jellyfin_id == ^user_jellyfin_id and
            fragment("date(?)", ps.start_time) >= ^thirty_days_ago,
        group_by: fragment("EXTRACT(DOW FROM ?)", ps.start_time),
        select: %{
          day_of_week: fragment("EXTRACT(DOW FROM ?)", ps.start_time),
          total_duration: sum(ps.play_duration)
        },
        order_by: fragment("EXTRACT(DOW FROM ?)", ps.start_time)
      )
      |> Repo.all()
      |> Enum.map(fn %{day_of_week: dow, total_duration: duration} ->
        # Postgres DOW: 0=Sunday, 1=Monday, ..., 6=Saturday. Convert to 1=Mon, ..., 7=Sun
        day = if dow == 0, do: 7, else: dow
        %{day_of_week: day, total_duration: duration}
      end)
      |> Enum.sort_by(& &1.day_of_week)
    else
      []
    end
  end
end
