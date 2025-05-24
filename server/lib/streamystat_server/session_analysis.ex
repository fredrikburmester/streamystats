defmodule StreamystatServer.SessionAnalysis do
  alias StreamystatServer.Repo
  alias StreamystatServer.Sessions.Models.PlaybackSession
  alias StreamystatServer.Jellyfin.Models.Item
  require Logger
  import Ecto.Query

  # Add a configurable cache TTL
  @cache_ttl :timer.minutes(1)  # Cache recommendations for 24 hours

  @doc """
  Removes all embeddings from jellyfin_items table for a specific server.
  Returns {:ok, count} where count is the number of items updated.
  """
  def remove_all_embeddings(server_id) do
    try do
      {count, _} = Repo.update_all(
        from(i in Item, where: not is_nil(i.embedding) and i.server_id == ^server_id),
        set: [embedding: nil]
      )
      {:ok, count}
    rescue
      e ->
        Logger.error("Failed to remove embeddings for server #{server_id}: #{inspect(e)}")
        {:error, "Failed to remove embeddings: #{Exception.message(e)}"}
    end
  end

  @doc """
  Finds similar items based on a user's viewing history.

  Improvements:
  - Adds weighting based on watch completion percentage
  - Adds genre filtering option
  - Adds caching mechanism
  - Returns "based on" information showing which movies contributed to each recommendation
  """
  def find_similar_items_for_user(user_id, opts \\ []) do
    opts = if Keyword.keyword?(opts), do: opts, else: [limit: opts]
    limit = Keyword.get(opts, :limit, 10)
    genre_filter = Keyword.get(opts, :genre)

    # Use cached results if available
    cache_key = "user_recommendations:#{user_id}:#{limit}:#{genre_filter}"
    case get_from_cache(cache_key) do
      nil ->
        # Get the items the user has watched with watch completion data
        watched_sessions =
          Repo.all(
            from(s in PlaybackSession,
              where: s.user_jellyfin_id == ^user_id,
              select: {s.item_jellyfin_id, s.percent_complete}
            )
          )

        # Group by item to handle multiple views of same item
        watched_data =
          Enum.reduce(watched_sessions, %{}, fn {item_id, pct}, acc ->
            Map.update(acc, item_id, pct, fn existing -> max(existing, pct) end)
          end)

        watched_item_ids = Map.keys(watched_data)

        # Get the embeddings for those items and include server_id for filtering
        watched_items =
          Repo.all(
            from(i in Item,
              where: i.jellyfin_id in ^watched_item_ids and not is_nil(i.embedding),
              select: %{item: i, server_id: i.server_id, library_id: i.library_id}
            )
          )

        # If no watched items with embeddings, return empty list
        if Enum.empty?(watched_items) do
          []
        else
          # Get server_id and library_id from the first item (assuming user has items from one server)
          # This helps avoid cross-server recommendations
          first_item = List.first(watched_items)
          server_id = first_item.server_id
          library_id = first_item.library_id

          # Calculate a weighted "user taste profile"
          # Extract just the items from the map
          items_only = Enum.map(watched_items, fn %{item: item} -> item end)
          weighted_embedding = weighted_average_embeddings(items_only, watched_data)

          # Find similar items using the weighted embedding and filter by server/library
          query = build_similarity_query(weighted_embedding, watched_item_ids, limit, genre_filter, server_id, library_id)
          similar_items = Repo.all(query)

          # For each recommendation, find the top 3 watched movies it's most similar to
          recommendations_with_based_on =
            Enum.map(similar_items, fn %{item: recommended_item, similarity: similarity} ->
              # Calculate similarity between this recommendation and each watched item
              watched_similarities =
                Enum.map(items_only, fn watched_item ->
                  item_similarity = calculate_similarity(recommended_item.embedding, watched_item.embedding)
                  weight = Map.get(watched_data, watched_item.jellyfin_id, 0.5)
                  # Combine similarity with user's engagement (watch completion)
                  weighted_similarity = item_similarity * (0.7 + weight * 0.3)
                  %{item: watched_item, similarity: weighted_similarity}
                end)
                |> Enum.sort_by(& &1.similarity, :desc)
                |> Enum.take(3)

              based_on_items = Enum.map(watched_similarities, & &1.item)

              %{
                item: recommended_item,
                similarity: similarity,
                based_on: based_on_items
              }
            end)

          # Store in cache
          put_in_cache(cache_key, recommendations_with_based_on, @cache_ttl)

          recommendations_with_based_on
        end
      cached_results ->
        cached_results
    end
  end

  @doc """
  Finds similar items to a specific item with improved similarity calculation.
  """
  def find_similar_items_to_item(item_jellyfin_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 10)
    genre_filter = Keyword.get(opts, :genre)

    # Try cache first
    cache_key = "item_recommendations:#{item_jellyfin_id}:#{limit}:#{genre_filter}"
    case get_from_cache(cache_key) do
      nil ->
        case Repo.one(
               from(i in Item, where: i.jellyfin_id == ^item_jellyfin_id and not is_nil(i.embedding))
             ) do
          nil ->
            []

          item ->
            # Use server_id and library_id to prevent cross-server recommendations
            query = build_similarity_query(item.embedding, [item_jellyfin_id], limit, genre_filter, item.server_id, item.library_id)
            similar_items = Repo.all(query)
            put_in_cache(cache_key, similar_items, @cache_ttl)
            similar_items
        end
      cached_results ->
        cached_results
    end
  end

  @doc """
  Finds items similar to those in a specific session.
  """
  def find_similar_items_for_session(session_id, limit \\ 10) do
    case Repo.one(from(s in PlaybackSession, where: s.id == ^session_id)) do
      nil ->
        []

      session ->
        item =
          Repo.one(
            from(i in Item,
              where: i.jellyfin_id == ^session.item_jellyfin_id and not is_nil(i.embedding)
            )
          )

        if item do
          # Use build_similarity_query with server and library filtering
          query = build_similarity_query(item.embedding, [item.jellyfin_id], limit, nil, item.server_id, item.library_id)
          Repo.all(query)
        else
          []
        end
    end
  end

  @doc """
  Finds the most popular items among sessions with similar viewing patterns.
  """
  def find_items_from_similar_sessions(item_jellyfin_id, limit \\ 10) do
    # Find sessions where this item was watched
    sessions =
      Repo.all(
        from(s in PlaybackSession,
          where: s.item_jellyfin_id == ^item_jellyfin_id,
          select: s.id
        )
      )

    if Enum.empty?(sessions) do
      []
    else
      # First, get the server_id and library_id of the original item for filtering
      base_item = Repo.one(from(i in Item, where: i.jellyfin_id == ^item_jellyfin_id, select: i))

      # Proceed only if we have the base item
      if base_item do
        server_id = base_item.server_id
        _library_id = base_item.library_id

        # Find users who watched this item
        users =
          Repo.all(
            from(s in PlaybackSession,
              where: s.item_jellyfin_id == ^item_jellyfin_id,
              select: s.user_jellyfin_id,
              distinct: true
            )
          )

        # Find other items these users watched
        other_items =
          Repo.all(
            from(s in PlaybackSession,
              where: s.user_jellyfin_id in ^users and s.item_jellyfin_id != ^item_jellyfin_id,
              group_by: s.item_jellyfin_id,
              select: {s.item_jellyfin_id, count(s.id)},
              order_by: [desc: count(s.id)],
              limit: ^limit
            )
          )

        # Fetch the actual items
        item_ids = Enum.map(other_items, fn {id, _} -> id end)

        Repo.all(
          from(i in Item,
            where: i.jellyfin_id in ^item_ids and i.server_id == ^server_id,
            order_by: fragment("array_position(?, jellyfin_id)", ^item_ids)
          )
        )
      else
        []
      end
    end
  end

  # Enhanced private helper functions

  defp weighted_average_embeddings(items, weight_map) do
    # Extract embeddings with weights
    embedding_data =
      Enum.map(items, fn item ->
        weight = Map.get(weight_map, item.jellyfin_id, 0.5)
        vector = ensure_list_format(item.embedding)
        {vector, weight}
      end)

    # Get dimensions from first embedding
    [{first_vector, _} | _] = embedding_data
    dims = length(first_vector)

    # Initialize an accumulator with zeros
    zeros = List.duplicate(0.0, dims)

    # Total weight for normalization
    total_weight = Enum.reduce(embedding_data, 0, fn {_, weight}, sum -> sum + weight end)
    total_weight = if total_weight == 0, do: 1, else: total_weight

    # Calculate weighted sum
    weighted_sum =
      Enum.reduce(embedding_data, zeros, fn {vector, weight}, acc ->
        weighted_vector = Enum.map(vector, fn val -> val * weight end)
        Enum.zip_with(weighted_vector, acc, fn e1, e2 -> e1 + e2 end)
      end)

    # Normalize by total weight
    averaged = Enum.map(weighted_sum, fn value -> value / total_weight end)

    # Convert back to Pgvector format
    Pgvector.new(averaged)
  end

  defp ensure_list_format(embedding) do
    if is_list(embedding), do: embedding, else: Pgvector.to_list(embedding)
  end

  defp build_similarity_query(embedding, excluded_item_ids, limit, genre_filter, server_id \\ nil, library_id \\ nil) do
    # Start with a simple query structure
    query = from(i in Item,
      where: i.jellyfin_id not in ^excluded_item_ids and not is_nil(i.embedding)
    )

    # Apply genre filter if provided
    query = if genre_filter do
      from(i in query, where: fragment("? && ?", i.genres, ^[genre_filter]))
    else
      query
    end

    # Apply server and library filters if provided
    query = if server_id do
      from(i in query, where: i.server_id == ^server_id)
    else
      query
    end

    query = if library_id do
      from(i in query, where: i.library_id == ^library_id)
    else
      query
    end

    # Add similarity calculation and ordering
    from(i in query,
      select: %{
        item: i,
        similarity: fragment("1 - (? <=> ?)", i.embedding, ^embedding)
      },
      order_by: [desc: fragment("1 - (? <=> ?)", i.embedding, ^embedding)],
      limit: ^limit
    )
  end

  # Helper function to calculate cosine similarity between two embeddings
  defp calculate_similarity(embedding1, embedding2) do
    # Convert embeddings to list format if needed
    vec1 = ensure_list_format(embedding1)
    vec2 = ensure_list_format(embedding2)

    # Calculate cosine similarity: (a · b) / (|a| * |b|)
    dot_product = Enum.zip_with(vec1, vec2, fn a, b -> a * b end) |> Enum.sum()
    magnitude1 = :math.sqrt(Enum.map(vec1, fn x -> x * x end) |> Enum.sum())
    magnitude2 = :math.sqrt(Enum.map(vec2, fn x -> x * x end) |> Enum.sum())

    if magnitude1 == 0 or magnitude2 == 0 do
      0.0
    else
      dot_product / (magnitude1 * magnitude2)
    end
  end

  # Cache functions
  defp get_from_cache(key) do
    try do
      case :ets.lookup(:recommendation_cache, key) do
        [{^key, value, expiry}] ->
          if System.system_time(:second) < expiry do
            value
          else
            # Delete expired entry
            :ets.delete(:recommendation_cache, key)
            nil
          end
        [] -> nil
      end
    rescue
      ArgumentError ->
        # Table doesn't exist, gracefully handle it
        Logger.warning("ETS table :recommendation_cache not found when trying to get #{key}")
        try_create_cache_table()
        nil
    end
  end

  defp put_in_cache(key, value, ttl) do
    try do
      expiry = System.system_time(:second) + ttl
      :ets.insert(:recommendation_cache, {key, value, expiry})
    rescue
      ArgumentError ->
        # Table doesn't exist, try to create it
        Logger.warning("ETS table :recommendation_cache not found when trying to put #{key}")
        if try_create_cache_table() do
          # Try again if table was created
          expiry = System.system_time(:second) + ttl
          :ets.insert(:recommendation_cache, {key, value, expiry})
        end
    end
  end

  # Attempt to create the cache table if it doesn't exist
  defp try_create_cache_table do
    try do
      :ets.new(:recommendation_cache, [:set, :public, :named_table])
      Logger.info("Created missing :recommendation_cache ETS table")
      true
    rescue
      ArgumentError ->
        # Table might have been created in the meantime by another process
        case :ets.info(:recommendation_cache) do
          :undefined ->
            Logger.error("Failed to create :recommendation_cache ETS table")
            false
          _ -> true
        end
    end
  end
end
