defmodule StreamystatServer.BatchEmbedder do
  alias StreamystatServer.Repo
  alias StreamystatServer.Jellyfin.Models.Item
  alias StreamystatServer.EmbeddingProvider.OpenAI
  alias StreamystatServer.Servers
  require Logger
  import Ecto.Query

  # Adjust these parameters based on your usage patterns and API limits
  # How many items to process in one API call
  @batch 20
  # Lower concurrency to avoid rate limits
  @concurrency 3
  # Extended timeout for batches with retries
  @timeout 60_000
  # Small delay between batches to avoid rate limiting
  @delay_between_batches 500

  def embed_all_items do
    Logger.info("Starting batch embedding process for movies without embeddings")

    # Get servers with OpenAI API tokens
    servers_with_tokens =
      Repo.all(
        from(s in Servers.Models.Server,
          where: not is_nil(s.open_ai_api_token),
          select: {s.id, s.open_ai_api_token}
        )
      )


    if Enum.empty?(servers_with_tokens) do
      Logger.warning("No servers with OpenAI API tokens found. Skipping embedding.")
      :ok
    else
      # Process each server
      Enum.each(servers_with_tokens, fn {server_id, token} ->
        embed_items_for_server(server_id, token)
      end)
    end
  end

  def embed_items_for_server(server_id, token) do
    items_count =
      Repo.one(
        from(i in Item,
          where:
            is_nil(i.embedding) and
              i.type == "Movie" and
              i.server_id == ^server_id,
          select: count()
        )
      )

    Logger.info("Found #{items_count} movies without embeddings for server #{server_id}")

    if items_count > 0 do
      Repo.transaction(
        fn ->
          Item
          |> where([i], is_nil(i.embedding) and i.type == "Movie" and i.server_id == ^server_id)
          |> Repo.stream()
          |> Stream.chunk_every(@batch, @batch)
          |> Task.async_stream(&embed_batch_with_direct_api(&1, token),
            max_concurrency: @concurrency,
            ordered: false,
            timeout: @timeout
          )
          |> Stream.run()
        end,
        timeout: :infinity
      )

      Logger.info("Completed batch embedding process for movies on server #{server_id}")
    end
  end

  # This function processes a batch by sending texts together to the OpenAI API
  defp embed_batch_with_direct_api(items, token) do
    # Extract texts for all items in batch
    texts_with_items = Enum.map(items, fn item -> {build_text(item), item} end)

    # Process only non-empty texts
    valid_texts_with_items =
      Enum.filter(texts_with_items, fn {text, _} ->
        text != nil && text != ""
      end)

    valid_texts = Enum.map(valid_texts_with_items, fn {text, _} -> text end)
    valid_items = Enum.map(valid_texts_with_items, fn {_, item} -> item end)

    if Enum.empty?(valid_texts) do
      Logger.warning("No valid texts found in batch of #{length(items)} items")
      :ok
    else
      # Use the OpenAI batch embedding functionality with the server's token
      case OpenAI.embed_batch(valid_texts, token) do
        {:ok, embeddings} ->
          # Process successful results
          Enum.zip(valid_items, embeddings)
          |> Enum.each(fn {item, embedding} ->
            Repo.update_all(
              from(i in Item, where: i.id == ^item.id),
              set: [embedding: embedding]
            )
          end)

          # Add a small delay to avoid rate limiting
          Process.sleep(@delay_between_batches)
          Logger.info("Successfully embedded batch of #{length(valid_items)} items")

        {:error, reason} ->
          Logger.error("Batch embedding failed: #{reason}")
          Logger.info("Falling back to individual processing for #{length(valid_items)} items")

          # Fall back to processing items individually
          Enum.each(valid_items, fn item ->
            embed_single_item(item, token)
            # Add a small delay between individual requests
            Process.sleep(200)
          end)
      end
    end
  end

  # Process a single item as a fallback
  defp embed_single_item(item, token) do
    text = build_text(item)

    if text != nil && text != "" do
      try do
        case OpenAI.embed(text, token) do
          {:ok, embedding} ->
            Repo.update_all(
              from(i in Item, where: i.id == ^item.id),
              set: [embedding: embedding]
            )

            Logger.info("Successfully embedded item #{item.id}")

          {:error, reason} ->
            Logger.error("Failed to embed item #{item.id}: #{reason}")
        end
      rescue
        e ->
          Logger.error("Exception when embedding item #{item.id}: #{inspect(e)}")
      end
    else
      Logger.warning("Skipping item #{item.id} - empty text")
    end
  end

  defp build_text(%Item{} = item) do
    people_text =
      if is_list(item.people) do
        item.people
        |> Enum.map(fn person ->
          name = Map.get(person, "Name", "")
          role = Map.get(person, "Role", "")
          type = Map.get(person, "Type", "")

          cond do
            # Skip if no name
            name == "" -> ""
            type == "" && role == "" -> name
            type == "" && role != "" -> "#{name} as #{role}"
            role == "" -> "#{name} (#{String.downcase(type)})"
            true -> "#{name} as #{role} (#{String.downcase(type)})"
          end
        end)
        # Remove empty strings
        |> Enum.filter(&(&1 != ""))
        |> Enum.join(", ")
      else
        item.people
      end

    [
      item.name,
      item.genres,
      item.type,
      item.community_rating,
      item.series_name,
      item.season_name,
      item.production_year,
      item.overview,
      people_text
    ]
    |> Enum.filter(&(&1 && &1 != ""))
    |> Enum.join(" ")
  end
end
