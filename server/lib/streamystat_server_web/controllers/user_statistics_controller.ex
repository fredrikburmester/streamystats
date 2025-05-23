defmodule StreamystatServerWeb.UserStatisticsController do
  use StreamystatServerWeb, :controller
  alias StreamystatServer.Statistics.Statistics
  alias StreamystatServer.Jellyfin.Models.User
  alias StreamystatServer.Sessions.Models.PlaybackSession
  alias StreamystatServer.Jellyfin.Models.Item
  alias StreamystatServer.Repo
  import Ecto.Query
  require Logger

  def watchtime_per_day(conn, params) do
    end_date = params["end_date"] || Date.utc_today() |> Date.to_iso8601()

    start_date =
      params["start_date"] || Date.add(Date.from_iso8601!(end_date), -30) |> Date.to_iso8601()

    server_id = params["server_id"]
    current_user = conn.assigns.current_user

    with {:ok, start_date} <- Date.from_iso8601(start_date),
         {:ok, end_date} <- Date.from_iso8601(end_date) do
      watchtime_stats =
        if is_admin?(current_user) do
          Statistics.get_watchtime_per_day_stats(start_date, end_date, server_id)
        else
          Statistics.get_watchtime_per_day_stats(
            start_date,
            end_date,
            server_id,
            current_user["Id"]
          )
        end

      render(conn, :watchtime_per_day, watchtime_stats: watchtime_stats)
    else
      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid date format. Please use ISO 8601 (YYYY-MM-DD)."})
    end
  end

  def user_activity(conn, params) do
    end_date = params["end_date"] || Date.utc_today() |> Date.to_iso8601()

    start_date =
      params["start_date"] || Date.add(Date.from_iso8601!(end_date), -30) |> Date.to_iso8601()

    server_id = params["server_id"]
    current_user = conn.assigns.current_user

    with {:ok, start_date} <- Date.from_iso8601(start_date),
         {:ok, end_date} <- Date.from_iso8601(end_date) do
      user_activity_stats =
        if is_admin?(current_user) do
          Statistics.get_user_activity_stats(start_date, end_date, server_id)
        else
          Statistics.get_user_activity_stats(
            start_date,
            end_date,
            server_id,
            current_user["Id"]
          )
        end

      render(conn, :user_activity, user_activity_stats: user_activity_stats)
    else
      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid date format. Please use ISO 8601 (YYYY-MM-DD)."})
    end
  end

  def index(conn, params) do
    end_date = params["end_date"] || Date.utc_today() |> Date.to_iso8601()

    start_date =
      params["start_date"] || Date.add(Date.from_iso8601!(end_date), -30) |> Date.to_iso8601()

    server_id = params["server_id"]
    current_user = conn.assigns.current_user

    with {:ok, start_date} <- Date.from_iso8601(start_date),
         {:ok, end_date} <- Date.from_iso8601(end_date) do
      statistics =
        if is_admin?(current_user) do
          Statistics.get_formatted_stats(start_date, end_date, server_id)
        else
          Statistics.get_formatted_stats(start_date, end_date, server_id, current_user["Id"])
        end

      render(conn, :index, statistics: statistics)
    else
      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid date format. Please use ISO 8601 (YYYY-MM-DD)."})
    end
  end

  def history(conn, params) do
    current_user = conn.assigns.current_user

    base_query =
      if is_admin?(current_user) do
        from(ps in PlaybackSession,
          join: i in Item,
          on: ps.item_jellyfin_id == i.jellyfin_id,
          join: u in User,
          on: ps.user_jellyfin_id == u.jellyfin_id,
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
      else
        from(ps in PlaybackSession,
          join: i in Item,
          on: ps.item_jellyfin_id == i.jellyfin_id,
          join: u in User,
          on: ps.user_jellyfin_id == u.jellyfin_id,
          where: ps.user_jellyfin_id == ^current_user["Id"],
          order_by: [desc: ps.start_time],
          select: %{
            id: ps.id,
            date_created: ps.start_time,
            item_id: ps.item_jellyfin_id,
            item_type: ps.item_type,
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
      end

    # Add server_id filter if provided
    filtered_base_query =
      case params["server_id"] do
        nil -> base_query
        server_id -> base_query |> where([ps, i, u], ps.server_id == ^server_id)
      end

    # Count total items for pagination metadata
    count_query = from(q in subquery(filtered_base_query), select: count(q.id))
    total_items = Repo.one(count_query)

    # Add pagination
    page = params["page"] || "1"
    per_page = params["per_page"] || "20"

    {page, _} = Integer.parse(page)
    {per_page, _} = Integer.parse(per_page)

    # Calculate total pages
    total_pages = ceil(total_items / per_page)

    paginated_query =
      filtered_base_query
      |> limit(^per_page)
      |> offset((^page - 1) * ^per_page)

    # Get the paginated data
    watch_activity = Repo.all(paginated_query)

    # Construct response with pagination metadata
    response = %{
      page: page,
      per_page: per_page,
      total_items: total_items,
      total_pages: total_pages,
      data: watch_activity
    }

    render(conn, :history, watch_activity: response)
  end

  def items(conn, %{"server_id" => server_id} = params) do
    page =
      case Integer.parse(params["page"] || "1") do
        {page, _} when page > 0 -> page
        _ -> 1
      end

    search =
      case params["search"] do
        nil -> nil
        "" -> nil
        search -> String.trim(search)
      end

    sort_by =
      case params["sort_by"] do
        "watch_count" -> :watch_count
        "total_watch_time" -> :total_watch_time
        _ -> :total_watch_time
      end

    sort_order =
      case params["sort_order"] do
        "asc" -> :asc
        "desc" -> :desc
        _ -> :desc
      end

    # Handle content type filter
    content_type =
      case params["type"] do
        nil -> nil
        "" -> nil
        "Episode" -> "Episode"
        "Movie" -> "Movie"
        "Series" -> "Series"
        _ -> nil
      end

    # Handle libraries filter
    libraries =
      case params["libraries"] do
        nil ->
          nil

        "" ->
          nil

        libraries_string ->
          libraries_string
          |> String.split(",")
          |> Enum.map(fn id ->
            case Integer.parse(String.trim(id)) do
              {library_id, _} -> library_id
              _ -> nil
            end
          end)
          |> Enum.reject(&is_nil/1)
          |> then(fn
            [] -> nil
            ids -> ids
          end)
      end

    Logger.debug(
      "Page: #{page}, Search: #{inspect(search)}, ID: #{inspect(server_id)}, " <>
        "Sort By: #{sort_by}, Sort Order: #{sort_order}, Type: #{inspect(content_type)}, " <>
        "Libraries: #{inspect(libraries)}"
    )

    item_stats =
      Statistics.get_item_statistics(
        server_id,
        page,
        search,
        sort_by,
        sort_order,
        content_type,
        libraries
      )

    render(conn, :items, item_stats: item_stats)
  end

  def library_stats(conn, %{"server_id" => server_id}) do
    stats = Statistics.get_library_statistics(server_id)
    render(conn, :library_stats, stats: stats)
  end

  def item_details(conn, %{"server_id" => server_id, "item_id" => item_id}) do
    current_user = conn.assigns.current_user

    item_stats =
      if is_admin?(current_user) do
        Statistics.get_item_details_statistics(server_id, item_id)
      else
        Statistics.get_item_details_statistics(server_id, item_id, current_user["Id"])
      end

    case item_stats do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Item not found"})

      _ ->
        render(conn, :item_details, item_stats: item_stats)
    end
  end

  def transcoding_statistics(conn, %{"server_id" => server_id}) do
    current_user = conn.assigns.current_user
    user_scope = if is_admin?(current_user), do: nil, else: current_user["Id"]

    stats =
      StreamystatServer.Statistics.Statistics.get_transcoding_statistics(server_id, user_scope)

    render(conn, :transcoding_statistics, stats: stats)
  end

  defp is_admin?(user) do
    user["Policy"]["IsAdministrator"] == true
  end
end
