defmodule StreamystatServer.Workers.SessionPoller do
  use GenServer
  require Logger
  alias StreamystatServer.Servers.Models.Server
  alias StreamystatServer.Contexts.PlaybackSessions
  alias StreamystatServer.Repo
  import Ecto.Query, warn: false

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def init(_opts) do
    schedule_polling(10_000)
    {:ok, %{tracked_sessions: %{}}}
  end

  def get_active_sessions(server_id) do
    GenServer.call(__MODULE__, {:get_active_sessions, server_id})
  end

  def handle_call({:get_active_sessions, server_id}, _from, state) do
    server_key = "server_#{server_id}"
    tracked_sessions = Map.get(state.tracked_sessions, server_key, %{})

    # Convert the map of sessions to a list and format for API
    active_sessions =
      tracked_sessions
      |> Map.values()
      |> Enum.map(fn session ->
        %{
          session_key: session.session_key,
          user_jellyfin_id: session.user_jellyfin_id,
          user_name: session.user_name,
          client_name: session.client_name,
          device_id: session.device_id,
          device_name: session.device_name,
          item_jellyfin_id: session.item_jellyfin_id,
          item_name: session.item_name,
          series_jellyfin_id: session.series_jellyfin_id,
          series_name: session.series_name,
          season_jellyfin_id: session.season_jellyfin_id,
          position_ticks: session.position_ticks,
          runtime_ticks: session.runtime_ticks,
          play_duration: session.play_duration,
          start_time: session.start_time,
          last_activity_date: session.last_activity_date,
          is_paused: session.is_paused,
          play_method: session.play_method
        }
      end)

    {:reply, active_sessions, state}
  end

  def handle_info(:poll_sessions, state) do
    servers = list_servers()
    updated_state = poll_all_servers(servers, state)
    schedule_polling(10_000)
    {:noreply, updated_state}
  end

  defp list_servers do
    Repo.all(Server)
  end

  defp poll_all_servers(servers, state) do
    Enum.reduce(servers, state, fn server, acc_state ->
      poll_server(server, acc_state)
    end)
  end

  defp poll_server(server, state) do
    case fetch_jellyfin_sessions(server) do
      {:ok, current_sessions} ->
        process_sessions(server, current_sessions, state)

      {:error, reason} ->
        Logger.error("Failed to fetch sessions for server #{server.id}: #{inspect(reason)}")
        state
    end
  end

  defp fetch_jellyfin_sessions(server) do
    url = "#{StreamystatServer.Servers.Models.Server.get_internal_url(server)}/Sessions"

    headers = [
      {"X-MediaBrowser-Token", server.api_key},
      {"Content-Type", "application/json"}
    ]

    case HTTPoison.get(url, headers) do
      {:ok, %{status_code: 200, body: body}} ->
        {:ok, Jason.decode!(body)}

      {:ok, response} ->
        {:error, "Unexpected response: #{inspect(response)}"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp process_sessions(server, current_sessions, state) do
    server_key = "server_#{server.id}"
    tracked_sessions = Map.get(state.tracked_sessions, server_key, %{})

    filtered_sessions = filter_valid_sessions(current_sessions)

    Logger.debug("Server #{server.id}: #{length(filtered_sessions)} active sessions")

    {new_sessions, updated_sessions, ended_sessions} =
      detect_session_changes(filtered_sessions, tracked_sessions)

    new_tracked_sessions = handle_new_sessions(server, new_sessions)

    merged_sessions = Map.merge(tracked_sessions, new_tracked_sessions)

    updated_tracked_sessions =
      handle_updated_sessions(server, updated_sessions, merged_sessions)

    final_tracked_sessions =
      handle_ended_sessions(server, ended_sessions, updated_tracked_sessions)

    %{
      state
      | tracked_sessions: Map.put(state.tracked_sessions, server_key, final_tracked_sessions)
    }
  end

  defp filter_valid_sessions(sessions) do
    Enum.filter(sessions, fn session ->
      case session do
        %{"NowPlayingItem" => item} when not is_nil(item) ->
          item_type = Map.get(item, "Type")
          provider_ids = Map.get(item, "ProviderIds", %{})
          item_type != "Trailer" && !Map.has_key?(provider_ids, "prerolls.video")

        _ ->
          false
      end
    end)
  end

  defp detect_session_changes(current_sessions, tracked_sessions) do
    current_map = sessions_to_map(current_sessions)

    new_sessions =
      Enum.filter(current_sessions, fn session ->
        session_key = generate_session_key(session)
        !Map.has_key?(tracked_sessions, session_key)
      end)

    updated_sessions =
      Enum.filter(current_sessions, fn session ->
        session_key = generate_session_key(session)
        Map.has_key?(tracked_sessions, session_key)
      end)

    ended_sessions =
      Enum.filter(Map.keys(tracked_sessions), fn key ->
        !Map.has_key?(current_map, key)
      end)
      |> Enum.map(fn key -> {key, Map.get(tracked_sessions, key)} end)

    {new_sessions, updated_sessions, ended_sessions}
  end

  defp generate_session_key(session) do
    user_id = Map.get(session, "UserId", "")
    device_id = Map.get(session, "DeviceId", "")

    item = Map.get(session, "NowPlayingItem", %{})
    item_id = Map.get(item, "Id", "")
    series_id = Map.get(item, "SeriesId", "")

    if series_id != "" do
      "#{user_id}|#{device_id}|#{series_id}|#{item_id}"
    else
      "#{user_id}|#{device_id}|#{item_id}"
    end
  end

  defp calculate_duration(tracked, current_paused, last_activity, last_paused, _current_position) do
    was_paused = tracked.is_paused

    cond do
      was_paused == false && current_paused == true && last_paused != nil ->
        tracked.play_duration +
          DateTime.diff(last_paused, tracked.last_update_time, :second)

      was_paused == false && current_paused == false ->
        tracked.play_duration +
          DateTime.diff(last_activity, tracked.last_update_time, :second)

      was_paused == true && current_paused == false ->
        tracked.play_duration

      true ->
        tracked.play_duration
    end
  end

  defp handle_ended_sessions(server, ended_sessions, tracked_sessions) do
    now = DateTime.utc_now()

    Enum.reduce(ended_sessions, tracked_sessions, fn {key, tracked}, acc ->
      final_duration =
        if !tracked.is_paused do
          tracked.play_duration + DateTime.diff(now, tracked.last_update_time, :second)
        else
          tracked.play_duration
        end

      if final_duration > 1 do
        percent_complete =
          if tracked.runtime_ticks > 0 do
            tracked.position_ticks / tracked.runtime_ticks * 100
          else
            0.0
          end

        completed = percent_complete > 90.0

        Logger.info(
          "Ended session for server #{server.id}: User: #{tracked.user_name}, " <>
            "Content: #{tracked.item_name}, " <>
            "Final duration: #{final_duration}s, " <>
            "Progress: #{Float.round(percent_complete, 1)}%, " <>
            "Completed: #{completed}"
        )

        # Extract transcode reasons as a list if available
        transcode_reasons =
          if is_list(tracked.transcode_reasons), do: tracked.transcode_reasons, else: nil

        playback_record = %{
          user_jellyfin_id: tracked.user_jellyfin_id,
          device_id: tracked.device_id,
          device_name: tracked.device_name,
          client_name: tracked.client_name,
          item_jellyfin_id: tracked.item_jellyfin_id,
          item_name: tracked.item_name,
          series_jellyfin_id: tracked.series_jellyfin_id,
          series_name: tracked.series_name,
          season_jellyfin_id: tracked.season_jellyfin_id,
          play_duration: final_duration,
          play_method: tracked.play_method,
          start_time: tracked.start_time,
          end_time: DateTime.utc_now(),
          position_ticks: tracked.position_ticks,
          runtime_ticks: tracked.runtime_ticks,
          percent_complete: percent_complete,
          completed: completed,
          server_id: server.id,
          user_name: tracked.user_name,

          # Include all fields from the PlaybackSession model
          is_paused: tracked.is_paused,
          is_muted: tracked.is_muted,
          volume_level: tracked.volume_level,
          audio_stream_index: tracked.audio_stream_index,
          subtitle_stream_index: tracked.subtitle_stream_index,
          media_source_id: tracked.media_source_id,
          repeat_mode: tracked.repeat_mode,
          playback_order: tracked.playback_order,
          remote_end_point: tracked.remote_end_point,
          session_id: tracked.session_id,
          last_activity_date: tracked.last_activity_date,
          last_playback_check_in: tracked.last_playback_check_in,
          application_version: tracked.application_version,
          is_active: tracked.is_active,

          # Transcoding fields
          transcoding_audio_codec: tracked.transcoding_audio_codec,
          transcoding_video_codec: tracked.transcoding_video_codec,
          transcoding_container: tracked.transcoding_container,
          transcoding_is_video_direct: tracked.transcoding_is_video_direct,
          transcoding_is_audio_direct: tracked.transcoding_is_audio_direct,
          transcoding_bitrate: tracked.transcoding_bitrate,
          transcoding_completion_percentage: tracked.transcoding_completion_percentage,
          transcoding_width: tracked.transcoding_width,
          transcoding_height: tracked.transcoding_height,
          transcoding_audio_channels: tracked.transcoding_audio_channels,
          transcoding_hardware_acceleration_type: tracked.transcoding_hardware_acceleration_type,
          transcoding_reasons: transcode_reasons
        }

        save_playback_record(server, playback_record)
      end

      Map.delete(acc, key)
    end)
  end

  defp sessions_to_map(sessions) do
    Enum.reduce(sessions, %{}, fn session, acc ->
      key = generate_session_key(session)
      Map.put(acc, key, session)
    end)
  end

  defp handle_new_sessions(server, new_sessions) do
    now = DateTime.utc_now()

    tracked =
      Enum.reduce(new_sessions, %{}, fn session, acc ->
        user_id = Map.get(session, "UserId")
        item = Map.get(session, "NowPlayingItem", %{})
        play_state = Map.get(session, "PlayState", %{})
        transcoding_info = Map.get(session, "TranscodingInfo")

        session_key = generate_session_key(session)

        user_name = Map.get(session, "UserName")
        item_name = Map.get(item, "Name")
        is_paused = Map.get(play_state, "IsPaused") || false
        last_activity = parse_jellyfin_date(Map.get(session, "LastActivityDate"))

        # Extract transcode reasons if available
        transcode_reasons =
          if is_map(transcoding_info) && Map.has_key?(transcoding_info, "TranscodeReasons") do
            Map.get(transcoding_info, "TranscodeReasons")
          else
            nil
          end

        tracking_record = %{
          session_key: session_key,
          user_jellyfin_id: user_id,
          user_name: user_name,
          client_name: Map.get(session, "Client"),
          device_id: Map.get(session, "DeviceId"),
          device_name: Map.get(session, "DeviceName"),
          item_jellyfin_id: Map.get(item, "Id"),
          item_name: item_name,
          series_jellyfin_id: Map.get(item, "SeriesId"),
          series_name: Map.get(item, "SeriesName"),
          season_jellyfin_id: Map.get(item, "SeasonId"),
          position_ticks: Map.get(play_state, "PositionTicks", 0),
          runtime_ticks: Map.get(item, "RunTimeTicks", 0),
          play_duration: 0,
          start_time: now,
          last_activity_date: last_activity,
          last_playback_check_in: parse_jellyfin_date(Map.get(session, "LastPlaybackCheckIn")),
          last_update_time: now,
          is_paused: is_paused,
          play_method: Map.get(play_state, "PlayMethod"),

          # PlayState fields
          is_muted: Map.get(play_state, "IsMuted"),
          volume_level: Map.get(play_state, "VolumeLevel"),
          audio_stream_index: Map.get(play_state, "AudioStreamIndex"),
          subtitle_stream_index: Map.get(play_state, "SubtitleStreamIndex"),
          media_source_id: Map.get(play_state, "MediaSourceId"),
          repeat_mode: Map.get(play_state, "RepeatMode"),
          playback_order: Map.get(play_state, "PlaybackOrder"),

          # Session fields
          remote_end_point: Map.get(session, "RemoteEndPoint"),
          # This maps to "Id" in Session object
          session_id: Map.get(session, "Id"),
          application_version: Map.get(session, "ApplicationVersion"),
          is_active: Map.get(session, "IsActive"),

          # TranscodingInfo fields
          transcoding_audio_codec: transcoding_info && Map.get(transcoding_info, "AudioCodec"),
          transcoding_video_codec: transcoding_info && Map.get(transcoding_info, "VideoCodec"),
          transcoding_container: transcoding_info && Map.get(transcoding_info, "Container"),
          transcoding_is_video_direct:
            transcoding_info && Map.get(transcoding_info, "IsVideoDirect"),
          transcoding_is_audio_direct:
            transcoding_info && Map.get(transcoding_info, "IsAudioDirect"),
          transcoding_bitrate: transcoding_info && Map.get(transcoding_info, "Bitrate"),
          transcoding_completion_percentage:
            transcoding_info && Map.get(transcoding_info, "CompletionPercentage"),
          transcoding_width: transcoding_info && Map.get(transcoding_info, "Width"),
          transcoding_height: transcoding_info && Map.get(transcoding_info, "Height"),
          transcoding_audio_channels:
            transcoding_info && Map.get(transcoding_info, "AudioChannels"),
          transcoding_hardware_acceleration_type:
            transcoding_info && Map.get(transcoding_info, "HardwareAccelerationType"),
          transcode_reasons: transcode_reasons
        }

        Logger.info(
          "New session for server #{server.id}: User: #{user_name}, Content: #{item_name}, Paused: #{is_paused}, Duration: 0s"
        )

        Map.put(acc, session_key, tracking_record)
      end)

    tracked
  end

  defp parse_jellyfin_date(nil), do: nil

  defp parse_jellyfin_date(date_str) do
    case DateTime.from_iso8601(date_str) do
      {:ok, datetime, _} -> datetime
      _ -> nil
    end
  end

  defp handle_updated_sessions(server, updated_sessions, tracked_sessions) do
    now = DateTime.utc_now()

    Enum.reduce(updated_sessions, tracked_sessions, fn session, acc ->
      session_key = generate_session_key(session)
      tracked = Map.get(acc, session_key)

      play_state = Map.get(session, "PlayState", %{})
      current_paused = Map.get(play_state, "IsPaused") || false
      current_position = Map.get(play_state, "PositionTicks", 0)
      last_activity = parse_jellyfin_date(Map.get(session, "LastActivityDate"))
      last_paused = parse_jellyfin_date(Map.get(session, "LastPausedDate"))

      updated_duration =
        calculate_duration(tracked, current_paused, last_activity, last_paused, current_position)

      pause_state_changed = current_paused != tracked.is_paused
      duration_increased = updated_duration > tracked.play_duration + 10

      if pause_state_changed || duration_increased do
        Logger.debug(
          "Updated session for server #{server.id}: User: #{tracked.user_name}, " <>
            "Content: #{tracked.item_name}, " <>
            "Paused: #{current_paused}, " <>
            "Duration: #{updated_duration}s, " <>
            "Position: #{format_ticks_as_time(current_position)}"
        )
      end

      # Get transcoding info if available
      transcoding_info = Map.get(session, "TranscodingInfo")

      # Extract updated fields from the TranscodingInfo
      transcoding_updates =
        if is_map(transcoding_info) do
          %{
            transcoding_audio_codec: Map.get(transcoding_info, "AudioCodec"),
            transcoding_video_codec: Map.get(transcoding_info, "VideoCodec"),
            transcoding_container: Map.get(transcoding_info, "Container"),
            transcoding_is_video_direct: Map.get(transcoding_info, "IsVideoDirect"),
            transcoding_is_audio_direct: Map.get(transcoding_info, "IsAudioDirect"),
            transcoding_bitrate: Map.get(transcoding_info, "Bitrate"),
            transcoding_completion_percentage: Map.get(transcoding_info, "CompletionPercentage"),
            transcoding_width: Map.get(transcoding_info, "Width"),
            transcoding_height: Map.get(transcoding_info, "Height"),
            transcoding_audio_channels: Map.get(transcoding_info, "AudioChannels"),
            transcoding_hardware_acceleration_type:
              Map.get(transcoding_info, "HardwareAccelerationType"),
            transcode_reasons: Map.get(transcoding_info, "TranscodeReasons")
          }
        else
          %{}
        end

      # Update PlayState fields
      play_state_updates = %{
        is_muted: Map.get(play_state, "IsMuted", tracked.is_muted),
        volume_level: Map.get(play_state, "VolumeLevel", tracked.volume_level),
        audio_stream_index: Map.get(play_state, "AudioStreamIndex", tracked.audio_stream_index),
        subtitle_stream_index:
          Map.get(play_state, "SubtitleStreamIndex", tracked.subtitle_stream_index),
        media_source_id: Map.get(play_state, "MediaSourceId", tracked.media_source_id),
        repeat_mode: Map.get(play_state, "RepeatMode", tracked.repeat_mode),
        playback_order: Map.get(play_state, "PlaybackOrder", tracked.playback_order)
      }

      # Basic session updates
      basic_updates = %{
        position_ticks: current_position,
        is_paused: current_paused,
        last_activity_date: last_activity,
        last_update_time: now,
        play_duration: updated_duration,
        application_version: Map.get(session, "ApplicationVersion", tracked.application_version),
        is_active: Map.get(session, "IsActive", tracked.is_active),
        remote_end_point: Map.get(session, "RemoteEndPoint", tracked.remote_end_point),
        last_playback_check_in:
          parse_jellyfin_date(Map.get(session, "LastPlaybackCheckIn")) ||
            tracked.last_playback_check_in
      }

      # Merge all updates
      updated_record =
        Map.merge(
          tracked,
          Map.merge(basic_updates, Map.merge(play_state_updates, transcoding_updates))
        )

      Map.put(acc, session_key, updated_record)
    end)
  end

  defp save_playback_record(server, record) do
    _user =
      PlaybackSessions.get_user_by_jellyfin_id(
        record.user_jellyfin_id,
        server.id
      )

    # We don't need to add user_id anymore since we use jellyfin_id as the primary key
    case PlaybackSessions.create_playback_session(record) do
      {:ok, _session} ->
        Logger.info("Successfully saved playback session for server #{server.id}")

      {:error, changeset} ->
        Logger.error("Failed to save playback session: #{inspect(changeset.errors)}")
    end
  end

  defp schedule_polling(interval_ms) do
    Process.send_after(self(), :poll_sessions, interval_ms)
  end

  defp format_ticks_as_time(ticks) when is_integer(ticks) and ticks > 0 do
    total_seconds = div(ticks, 10_000_000)

    hours = div(total_seconds, 3600)
    minutes = div(rem(total_seconds, 3600), 60)
    seconds = rem(total_seconds, 60)

    "#{pad_time(hours)}:#{pad_time(minutes)}:#{pad_time(seconds)}"
  end

  defp format_ticks_as_time(_), do: "00:00:00"

  defp pad_time(time), do: String.pad_leading("#{time}", 2, "0")
end
