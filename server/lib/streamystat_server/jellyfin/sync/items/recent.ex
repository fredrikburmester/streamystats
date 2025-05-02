defmodule StreamystatServer.Jellyfin.Sync.Items.Recent do
  @moduledoc """
  Handles syncing of recently added items from Jellyfin.
  """

  import Ecto.Query
  require Logger

  alias StreamystatServer.Repo
  alias StreamystatServer.Jellyfin.Client
  alias StreamystatServer.Jellyfin.Models.Item
  alias StreamystatServer.Jellyfin.Sync.Utils
  alias StreamystatServer.Jellyfin.Sync.Metrics
  alias StreamystatServer.Jellyfin.Sync.Items.Mapper

  @doc """
  Synchronizes recently added items from a Jellyfin server.
  Only updates items if tracked fields have changed.
  """
  def sync_recently_added(server, limit \\ 50) do
    start_time = System.monotonic_time(:millisecond)

    metrics = %{
      items_processed: 0,
      items_inserted: 0,
      items_updated: 0,
      items_unchanged: 0,
      api_requests: 0,
      database_operations: 0,
      errors: []
    }

    Logger.info("Starting recently added items sync for server #{server.name}")

    {result, updated_metrics} =
      try do
        # Fetch libraries
        libraries = Utils.get_libraries_by_server(server.id)
        metrics = Map.update(metrics, :api_requests, 1, &(&1 + 1))

        # Collect recent items from all libraries with their already-known library IDs
        {all_mapped_items, invalid_items, updated_metrics} =
          Enum.reduce(libraries, {[], [], metrics}, fn library,
                                                       {items_acc, invalid_acc, metrics_acc} ->
            case Client.get_recently_added_items_by_library(server, library.jellyfin_id, limit) do
              {:ok, library_items} ->
                # Increment metrics
                updated_metrics =
                  metrics_acc
                  |> Map.update(:api_requests, 1, &(&1 + 1))
                  |> Map.update(
                    :items_processed,
                    length(library_items),
                    &(&1 + length(library_items))
                  )

                Logger.debug(
                  "Retrieved #{length(library_items)} recently added items from library #{library.name}"
                )

                # Map items, knowing they belong to the current library
                {valid, invalid} =
                  map_items_with_known_library(library_items, library.id, server.id)

                {items_acc ++ valid, invalid_acc ++ invalid, updated_metrics}

              {:error, reason} ->
                Logger.error(
                  "API error when fetching items from library #{library.name}: #{inspect(reason)}"
                )

                updated_metrics =
                  metrics_acc
                  |> Map.update(:api_requests, 1, &(&1 + 1))
                  |> Map.update(:errors, [reason], fn errors -> [reason | errors] end)

                {items_acc, invalid_acc, updated_metrics}
            end
          end)

        Logger.debug("Total recently added items collected: #{length(all_mapped_items)}")

        case all_mapped_items do
          [] ->
            Logger.info("No recently added items found across libraries")
            {{:ok, 0, 0, 0}, updated_metrics}

          _ ->
            updated_metrics = Map.update(updated_metrics, :database_operations, 1, &(&1 + 1))
            process_valid_items(all_mapped_items, invalid_items, server, updated_metrics)
        end
      rescue
        e ->
          stacktrace = Exception.format_stacktrace()

          error_message =
            "Unexpected error in sync_recently_added: #{Exception.message(e)}\n#{stacktrace}"

          Logger.error(error_message)

          {{:error, Exception.message(e)},
           Map.update(metrics, :errors, [error_message], fn errors ->
             [error_message | errors]
           end)}
      end

    end_time = System.monotonic_time(:millisecond)
    duration_ms = end_time - start_time

    Metrics.log_summary(
      server.name,
      "Recently added items sync",
      updated_metrics,
      duration_ms
    )

    {result, updated_metrics}
  end

  # Private helper functions

  defp map_items_with_known_library(items, library_id, server_id) do
    Enum.reduce(items, {[], []}, fn item, {valid, invalid} ->
      try do
        # We already know the library_id since we fetched per library
        mapped_item = Mapper.map_jellyfin_item(item, library_id, server_id)
        {[mapped_item | valid], invalid}
      rescue
        e ->
          # Catch any mapping errors
          Logger.error("Error mapping item #{inspect(item["Id"])}: #{Exception.message(e)}")
          {valid, [%{id: item["Id"], error: Exception.message(e)} | invalid]}
      end
    end)
  end

  defp process_valid_items(valid_items, invalid_items, server, metrics) do
    # Fetch existing items with all fields to compare
    jellyfin_ids = Enum.map(valid_items, & &1.jellyfin_id)

    existing_items =
      Repo.all(
        from(i in Item,
          where: i.jellyfin_id in ^jellyfin_ids and i.server_id == ^server.id
        )
      )

    existing_map =
      Enum.into(existing_items, %{}, fn item -> {item.jellyfin_id, item} end)

    # Fields that we track for changes
    tracked_fields = [
      :name,
      :original_title,
      :etag,
      :container,
      :sort_name,
      :premiere_date,
      :external_urls,
      :path,
      :official_rating,
      :overview,
      :genres,
      :community_rating,
      :runtime_ticks,
      :production_year,
      :is_folder,
      :parent_id,
      :media_type,
      :width,
      :height,
      :series_name,
      :series_id,
      :season_id,
      :season_name,
      :index_number,
      :parent_index_number,
      :primary_image_tag,
      :backdrop_image_tags,
      :image_blur_hashes,
      :video_type,
      :has_subtitles,
      :channel_id,
      :parent_backdrop_item_id,
      :parent_backdrop_image_tags,
      :parent_thumb_item_id,
      :parent_thumb_image_tag,
      :location_type,
      :primary_image_aspect_ratio,
      :series_primary_image_tag,
      :primary_image_thumb_tag,
      :primary_image_logo_tag,
      :people
    ]

    # Separate items into inserts and updates
    {items_to_insert, items_to_update, unchanged_items} =
      Enum.reduce(valid_items, {[], [], []}, fn item, {inserts, updates, unchanged} ->
        case Map.get(existing_map, item.jellyfin_id) do
          nil ->
            # New item, add to inserts
            {[item | inserts], updates, unchanged}

          existing ->
            # Check if any tracked field has changed or if images have changed
            if Utils.fields_changed?(existing, item, tracked_fields) or
                 Utils.image_fields_changed?(existing, item) do
              # If only images changed, log it
              if not Utils.fields_changed?(existing, item, tracked_fields) and
                   Utils.image_fields_changed?(existing, item) do
                Logger.info("Image update detected for item #{item.jellyfin_id}")
              end
              {inserts, [item | updates], unchanged}
            else
              {inserts, updates, [item | unchanged]}
            end
        end
      end)

    # Process insertions and updates
    {insert_result, update_result, unchanged_count} =
      do_process_item_changes(
        items_to_insert,
        items_to_update,
        unchanged_items,
        server.id,
        tracked_fields
      )

    metrics =
      metrics
      |> Map.put(:items_inserted, insert_result)
      |> Map.put(:items_updated, update_result)
      |> Map.put(:items_unchanged, unchanged_count)

    if length(invalid_items) > 0 do
      metrics =
        Map.update(
          metrics,
          :errors,
          invalid_items,
          fn errors -> errors ++ invalid_items end
        )

      {{:partial, insert_result, update_result, unchanged_count, invalid_items}, metrics}
    else
      {{:ok, insert_result, update_result, unchanged_count}, metrics}
    end
  end

  defp do_process_item_changes(
         items_to_insert,
         items_to_update,
         unchanged_items,
         server_id,
         tracked_fields
       ) do
    # Insert new items
    insert_result =
      unless Enum.empty?(items_to_insert) do
        {count, _} = Repo.insert_all(Item, items_to_insert)
        count
      else
        0
      end

    # Update changed items
    update_result =
      Enum.reduce(items_to_update, 0, fn item, count ->
        # Convert struct/map to keyword list for update_all
        update_fields =
          tracked_fields
          |> Enum.map(fn field -> {field, Map.get(item, field)} end)
          |> Enum.into([])

        {updated, _} =
          Repo.update_all(
            from(i in Item,
              where:
                i.jellyfin_id == ^item.jellyfin_id and
                  i.server_id == ^server_id
            ),
            set: update_fields
          )

        count + updated
      end)

    unchanged_count = length(unchanged_items)

    {insert_result, update_result, unchanged_count}
  end
end
