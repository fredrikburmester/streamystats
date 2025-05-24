defmodule StreamystatServerWeb.UserStatisticsJSON do
  def index(%{statistics: statistics}) do
    %{data: statistics}
  end

  def history(%{watch_activity: watch_activity}) do
    %{
      page: watch_activity.page,
      per_page: watch_activity.per_page,
      total_items: watch_activity.total_items,
      total_pages: watch_activity.total_pages,
      data:
        for activity <- watch_activity.data do
          %{
            id: activity.id,
            date_created: activity.date_created,
            item_id: activity.item_id,
            item_type: activity.item_type,
            item_name: activity.item_name,
            client_name: activity.client_name,
            device_name: activity.device_name,
            play_method: activity.play_method,
            play_duration: activity.play_duration,
            percent_complete: activity.percent_complete || 0,
            completed: activity.completed || false,
            series_name: activity.series_name,
            season_name: activity.season_name,
            index_number: activity.index_number,
            primary_image_tag: activity.primary_image_tag,
            backdrop_image_tags: activity.backdrop_image_tags,
            image_blur_hashes: activity.image_blur_hashes,
            parent_backdrop_item_id: activity.parent_backdrop_item_id,
            parent_backdrop_image_tags: activity.parent_backdrop_image_tags,
            parent_thumb_item_id: activity.parent_thumb_item_id,
            parent_thumb_image_tag: activity.parent_thumb_image_tag,
            primary_image_aspect_ratio: activity.primary_image_aspect_ratio,
            series_primary_image_tag: activity.series_primary_image_tag,
            primary_image_thumb_tag: activity.primary_image_thumb_tag,
            primary_image_logo_tag: activity.primary_image_logo_tag,
            user_jellyfin_id: activity.user_jellyfin_id,
            user_name: activity.user_name,
            transcoding_audio_codec: activity.transcoding_audio_codec,
            transcoding_video_codec: activity.transcoding_video_codec,
            transcoding_container: activity.transcoding_container,
            transcoding_is_video_direct: activity.transcoding_is_video_direct,
            transcoding_is_audio_direct: activity.transcoding_is_audio_direct,
            transcoding_bitrate: activity.transcoding_bitrate,
            transcoding_completion_percentage: activity.transcoding_completion_percentage,
            transcoding_width: activity.transcoding_width,
            transcoding_height: activity.transcoding_height,
            transcoding_audio_channels: activity.transcoding_audio_channels,
            transcoding_hardware_acceleration_type: activity.transcoding_hardware_acceleration_type,
            transcoding_reasons: activity.transcoding_reasons,
            remote_end_point: activity.remote_end_point
          }
        end
    }
  end

  def item_details(%{item_stats: item_stats}) do
    %{
      data: %{
        item: %{
          jellyfin_id: item_stats.item.jellyfin_id,
          name: item_stats.item.name,
          type: item_stats.item.type,
          original_title: item_stats.item.original_title,
          overview: item_stats.item.overview,
          production_year: item_stats.item.production_year,
          runtime_ticks: item_stats.item.runtime_ticks,
          genres: item_stats.item.genres,
          community_rating: item_stats.item.community_rating,
          official_rating: item_stats.item.official_rating,
          series_name: item_stats.item.series_name,
          season_name: item_stats.item.season_name,
          index_number: item_stats.item.index_number,
          primary_image_tag: item_stats.item.primary_image_tag,
          primary_image_aspect_ratio: item_stats.item.primary_image_aspect_ratio
        },
        statistics: %{
          total_views: item_stats.total_views,
          total_watch_time: item_stats.total_watch_time,
          completion_rate: item_stats.completion_rate,
          last_watched: item_stats.last_watched,
          first_watched: item_stats.first_watched,
          users_watched: item_stats.users_watched,
          watch_history: item_stats.watch_history,
          watch_count_by_month: item_stats.watch_count_by_month
        }
      }
    }
  end

  def watchtime_per_day(%{watchtime_stats: watchtime_stats}) do
    %{
      data: watchtime_stats.watchtime_per_day
    }
  end

  def user_activity(%{user_activity_stats: user_activity_stats}) do
    %{
      data: user_activity_stats.user_activity_per_day
    }
  end

  def items(%{item_stats: item_stats}) do
    %{
      data: Enum.map(item_stats.items, &item_data/1),
      page: item_stats.page,
      per_page: item_stats.per_page,
      total_items: item_stats.total_items,
      total_pages: item_stats.total_pages
    }
  end

  def library_stats(%{stats: stats}) do
    %{data: stats}
  end

  def transcoding_statistics(%{stats: stats}) do
    %{
      data: stats
    }
  end

  defp item_data(item) do
    %{
      item_id: item.item_id,
      item: %{
        jellyfin_id: item.item.jellyfin_id,
        name: item.item.name,
        type: item.item.type,
        original_title: item.item.original_title,
        etag: item.item.etag,
        date_created: item.item.date_created,
        container: item.item.container,
        sort_name: item.item.sort_name,
        premiere_date: item.item.premiere_date,
        external_urls: item.item.external_urls,
        path: item.item.path,
        official_rating: item.item.official_rating,
        overview: item.item.overview,
        genres: item.item.genres,
        community_rating: item.item.community_rating,
        runtime_ticks: item.item.runtime_ticks,
        production_year: item.item.production_year,
        is_folder: item.item.is_folder,
        parent_id: item.item.parent_id,
        media_type: item.item.media_type,
        width: item.item.width,
        height: item.item.height,
        library_id: item.item.library_id,
        server_id: item.item.server_id,
        series_name: item.item.series_name,
        series_id: item.item.series_id,
        season_id: item.item.season_id,
        season_name: item.item.season_name,
        index_number: item.item.index_number,
        parent_index_number: item.item.parent_index_number,
        primary_image_tag: item.item.primary_image_tag,
        primary_image_thumb_tag: item.item.primary_image_thumb_tag,
        primary_image_logo_tag: item.item.primary_image_logo_tag,
        backdrop_image_tags: item.item.backdrop_image_tags,
        image_blur_hashes: item.item.image_blur_hashes,
        video_type: item.item.video_type,
        has_subtitles: item.item.has_subtitles,
        channel_id: item.item.channel_id,
        parent_backdrop_item_id: item.item.parent_backdrop_item_id,
        parent_backdrop_image_tags: item.item.parent_backdrop_image_tags,
        parent_thumb_item_id: item.item.parent_thumb_item_id,
        parent_thumb_image_tag: item.item.parent_thumb_image_tag,
        location_type: item.item.location_type,
        primary_image_aspect_ratio: item.item.primary_image_aspect_ratio,
        series_primary_image_tag: item.item.series_primary_image_tag,
        inserted_at: item.item.inserted_at,
        updated_at: item.item.updated_at
      },
      watch_count: item.watch_count,
      total_watch_time: item.total_watch_time
    }
  end
end
