defmodule StreamystatServer.Statistics.Statistics do
  import Ecto.Query, warn: false
  alias StreamystatServer.Sessions.Models.PlaybackSession
  alias StreamystatServer.Jellyfin.Models.Item
  alias StreamystatServer.Jellyfin.Models.Library
  alias StreamystatServer.Jellyfin.Models.User
  alias StreamystatServer.Repo
  require Logger

  def create_playback_stat(attrs \\ %{}) do
    StreamystatServer.Contexts.PlaybackSessions.create_playback_session(attrs)
  end

  # Optimize the watchtime_per_day_stats function to do aggregation in the database
  def get_watchtime_per_day_stats(start_date, end_date, server_id, user_id \\ nil) do
    # Convert dates to datetimes
    start_datetime = to_datetime(start_date)
    end_datetime = to_datetime(end_date, :end_of_day)

    # Build the base query with proper filters
    query =
      from ps in PlaybackSession,
        left_join: i in Item,
        on: ps.item_jellyfin_id == i.jellyfin_id and ps.server_id == i.server_id,
        where: ps.start_time >= ^start_datetime and ps.start_time <= ^end_datetime,
      where: ps.server_id == ^server_id

    # Apply user filter if needed
    query = if user_id, do: query |> where([ps], ps.user_jellyfin_id == ^user_id), else: query

    # Use SQL date_trunc to group by day and type, performing the aggregation in the database
    watchtime_data =
        query
      |> group_by([ps, i], [fragment("date_trunc('day', ?)", ps.start_time), i.type])
      |> select([ps, i], %{
        date: fragment("date_trunc('day', ?)", ps.start_time),
        item_type: coalesce(i.type, "Unknown"),
        total_duration: sum(ps.play_duration)
      })
      |> Repo.all()

    # Format the result as expected
    formatted_data =
      watchtime_data
      |> Enum.group_by(&Date.to_iso8601(&1.date))
    |> Enum.map(fn {date, items} ->
      %{
        date: date,
          watchtime_by_type: Enum.map(items, fn item ->
            %{
              item_type: item.item_type,
              total_duration: item.total_duration || 0
            }
          end)
      }
    end)
    |> Enum.sort_by(& &1.date)

    %{watchtime_per_day: formatted_data}
  end

  def get_formatted_stats(_start_date, _end_date, server_id, user_id \\ nil) do
    # Get total_watch_time directly from database
    total_watch_time = get_total_watch_time_db(server_id, user_id)

    # Get most_watched_date directly from database
    most_watched_date = get_most_watched_date_db(server_id, user_id)

    # Get top_watched_items directly from database
    most_watched_items = get_top_watched_items_db(server_id, user_id)
    # Get average_watchtime_per_week_day directly from database
    average_watchtime_per_week_day = get_average_watchtime_per_week_day_db(server_id, user_id)
      %{
      most_watched_items: most_watched_items,
      average_watchtime_per_week_day: average_watchtime_per_week_day,
      total_watch_time: total_watch_time,
      most_watched_date: most_watched_date
      }
  end

  def get_unwatched_items(server_id, type \\ "Movie", page \\ 1, per_page \\ 20) do
    # Validate type parameter
    type = if type in ["Movie", "Series", "Episode"], do: type, else: "Movie"

    # Build a subquery to find all item ids that have been watched
    watched_items_query =
      from ps in PlaybackSession,
      where: ps.server_id == ^server_id,
      select: ps.item_jellyfin_id

    # Main query to find all items of given type that don't have playback sessions
    query =
      from i in Item,
      where: i.server_id == ^server_id and i.type == ^type,
      where: not(i.jellyfin_id in subquery(watched_items_query)),
      order_by: [desc: i.date_created],
      select: i

    # Calculate pagination values
    offset = (page - 1) * per_page

    # Execute query with pagination
    items =
      query
      |> limit(^per_page)
      |> offset(^offset)
      |> Repo.all()

    # Count total items for pagination metadata
    total_items =
      from(i in Item,
        where: i.server_id == ^server_id and i.type == ^type,
        where: not(i.jellyfin_id in subquery(watched_items_query)),
        select: count(i.id)
      )
      |> Repo.one()

    # Calculate total pages
    total_pages = div(total_items + per_page - 1, per_page)

    # Return paginated result with metadata
    %{
      items: items,
      page: page,
      per_page: per_page,
      total_items: total_items,
      total_pages: total_pages
    }
  end

  def get_library_statistics(server_id) do
    %{
      movies_count:
        Repo.one(
          from(i in Item, where: i.server_id == ^server_id and i.type == "Movie", select: count())
        ),
      episodes_count:
        Repo.one(
          from(i in Item,
            where: i.server_id == ^server_id and i.type == "Episode",
            select: count()
          )
        ),
      series_count:
        Repo.one(
          from(i in Item,
            where: i.server_id == ^server_id and i.type == "Series",
            select: count()
          )
        ),
      libraries_count:
        Repo.one(from(l in Library, where: l.server_id == ^server_id, select: count())),
      users_count: Repo.one(from(u in User, where: u.server_id == ^server_id, select: count()))
    }
end

  def get_item_statistics(
        server_id,
        page \\ 1,
        search \\ nil,
        sort_by \\ :total_watch_time,
        sort_order \\ :desc,
        content_type \\ nil
      ) do
    per_page = 20

    # Validate and normalize sort parameters
    sort_by =
      case sort_by do
        :watch_count -> :watch_count
        :total_watch_time -> :total_watch_time
        _ -> :total_watch_time
      end

    sort_order =
      case sort_order do
        :asc -> :asc
        :desc -> :desc
        _ -> :desc
      end

    # Determine which content types to include based on the filter
    content_types =
      case content_type do
        "Movie" -> ["Movie"]
        "Episode" -> ["Episode"]
        "Series" -> ["Series"]
        _ -> ["Movie", "Episode", "Series"]
      end

    # Base query for items of specified content types
    base_query =
      from(i in Item,
        left_join: ps in PlaybackSession,
        on: ps.item_jellyfin_id == i.jellyfin_id and ps.server_id == i.server_id,
        where: i.server_id == ^server_id and i.type in ^content_types,
        group_by: [i.id, i.jellyfin_id, i.name, i.type],
        select: %{
          item_id: i.jellyfin_id,
          item: i,
          watch_count: coalesce(count(ps.id), 0),
          total_watch_time: coalesce(sum(ps.play_duration), 0)
        }
      )

    # Apply search filter if provided
    query =
      if search do
        search_term = "%#{search}%"

        where(
          base_query,
          [i, ps],
          ilike(i.name, ^search_term) or
            ilike(fragment("?::text", i.production_year), ^search_term) or
            ilike(i.season_name, ^search_term) or
            ilike(i.series_name, ^search_term)
        )
      else
        base_query
      end

    # Apply sorting
    query =
      case {sort_by, sort_order} do
        {:watch_count, :asc} ->
          order_by(query, [i, ps], asc: coalesce(count(ps.id), 0))

        {:watch_count, :desc} ->
          order_by(query, [i, ps], desc: coalesce(count(ps.id), 0))

        {:total_watch_time, :asc} ->
          order_by(query, [i, ps], asc: coalesce(sum(ps.play_duration), 0))

        {:total_watch_time, :desc} ->
          order_by(query, [i, ps], desc: coalesce(sum(ps.play_duration), 0))
      end

    # Paginate items
    offset = (page - 1) * per_page

    items =
      query
      |> limit(^per_page)
      |> offset(^offset)
      |> Repo.all()

    # Count total items
    total_items_query =
      from(i in Item,
        where: i.server_id == ^server_id and i.type in ^content_types,
        select: i.id
      )

    # Apply the same search filter to the count query
    total_items_query =
      if search do
        search_term = "%#{search}%"

        where(
          total_items_query,
          [i],
          ilike(i.name, ^search_term) or
            ilike(fragment("?::text", i.production_year), ^search_term) or
            ilike(i.season_name, ^search_term) or
            ilike(i.series_name, ^search_term)
        )
      else
        total_items_query
      end

    # Fetch total item count
    total_items = total_items_query |> Repo.aggregate(:count, :id)
    total_pages = div(total_items + per_page - 1, per_page)

    %{
      items: items,
      page: page,
      per_page: per_page,
      total_items: total_items,
      total_pages: total_pages,
      sort_by: sort_by,
      sort_order: sort_order,
      content_type: content_type
    }
  end

  def get_most_watched_date(stats) do
    case stats do
      [] -> nil
      _ ->
        stats
        |> Enum.group_by(
          fn stat -> DateTime.to_date(stat.date_created) end,
          fn stat -> stat.play_duration || 0 end
        )
        |> Enum.map(fn {date, durations} ->
          %{
            date: date,
            total_duration: Enum.sum(durations)
          }
        end)
        |> Enum.max_by(& &1.total_duration, fn -> %{date: nil, total_duration: 0} end)
    end
  end

  # Optimized database functions that avoid loading all data into memory

  # Get total watch time directly from the database
  defp get_total_watch_time_db(server_id, user_id) do
    query =
      from ps in PlaybackSession,
      where: ps.server_id == ^server_id,
      select: sum(ps.play_duration)

    query = if user_id, do: query |> where([ps], ps.user_jellyfin_id == ^user_id), else: query

    Repo.one(query) || 0
  end

  # Get most watched date directly from the database
  defp get_most_watched_date_db(server_id, user_id) do
    query =
      from ps in PlaybackSession,
      where: ps.server_id == ^server_id,
      group_by: [fragment("date(start_time)")],
      select: %{
        date: fragment("date(start_time)"),
        total_duration: sum(ps.play_duration)
      },
      order_by: [desc: sum(ps.play_duration)],
      limit: 1

    query = if user_id, do: query |> where([ps], ps.user_jellyfin_id == ^user_id), else: query

    Repo.one(query) || %{date: nil, total_duration: 0}
  end

  # Get top watched items directly from the database
  defp get_top_watched_items_db(server_id, user_id) do
    # First, get a list of distinct item types to create our categories
    item_types_query =
      from i in Item,
      where: i.server_id == ^server_id,
      distinct: i.type,
      where: not is_nil(i.type),
      select: i.type

    item_types = Repo.all(item_types_query)

    # Then, for each type, get the top 10 items
    Enum.reduce(item_types, %{}, fn item_type, acc ->
      query =
        from ps in PlaybackSession,
        join: i in Item, on: ps.item_jellyfin_id == i.jellyfin_id and ps.server_id == i.server_id,
        where: ps.server_id == ^server_id and i.type == ^item_type,
        group_by: [i.id, i.jellyfin_id, i.name, i.type],
        select: %{
          id: i.id,
          jellyfin_id: i.jellyfin_id,
          name: i.name,
          type: i.type,
          original_title: i.original_title,
          production_year: i.production_year,
          series_name: i.series_name,
          season_name: i.season_name,
          index_number: i.index_number,
          primary_image_tag: i.primary_image_tag,
          primary_image_aspect_ratio: i.primary_image_aspect_ratio,
          server_id: i.server_id,
          total_play_count: count(ps.id),
          total_play_duration: sum(ps.play_duration)
        },
        order_by: [desc: sum(ps.play_duration)],
        limit: 10

      query = if user_id, do: query |> where([ps], ps.user_jellyfin_id == ^user_id), else: query

      items = Repo.all(query)
      Map.put(acc, item_type, items)
    end)
  end

  # Get average watchtime per week day directly from the database
  defp get_average_watchtime_per_week_day_db(server_id, user_id) do
    query =
      from ps in PlaybackSession,
      where: ps.server_id == ^server_id,
      group_by: [fragment("EXTRACT(DOW FROM start_time)")],
      select: %{
        day_of_week: fragment("EXTRACT(DOW FROM start_time)::integer + 1"), # PostgreSQL uses 0-6 for Sun-Sat, we want 1-7
        play_count: count(ps.id),
        total_duration: sum(ps.play_duration)
      }

    query = if user_id, do: query |> where([ps], ps.user_jellyfin_id == ^user_id), else: query

    Repo.all(query)
    |> Enum.map(fn day ->
      average_duration = if day.play_count > 0, do: day.total_duration / day.play_count, else: 0
      %{
        day_of_week: day.day_of_week,
        average_duration: Float.round(average_duration, 2)
      }
    end)
    |> Enum.sort_by(& &1.day_of_week)
  end

  defp to_datetime(date, time \\ :beginning_of_day) do
    time_struct = if time == :end_of_day, do: Time.new!(23, 59, 59), else: Time.new!(0, 0, 0)

    date
    |> DateTime.new!(time_struct, "Etc/UTC")
  end
end
