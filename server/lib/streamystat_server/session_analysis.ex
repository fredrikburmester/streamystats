defmodule StreamystatServer.SessionAnalysis do
  alias StreamystatServer.Repo
  alias StreamystatServer.Sessions.Models.PlaybackSession
  alias StreamystatServer.Jellyfin.Models.Item
  require Logger
  import Ecto.Query

  # Add a configurable similarity threshold and cache TTL
  @similarity_threshold 0.7  # Minimum similarity score to consider
  @cache_ttl :timer.hours(24)  # Cache recommendations for 24 hours

  @doc """
  Finds similar items based on a user's viewing history.

  Improvements:
  - Adds weighting based on watch completion percentage
  - Adds genre filtering option
  - Adds caching mechanism
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
              where: s.user_id == ^user_id,
              select: {s.item_jellyfin_id, s.percent_complete}
        )
      )

        # Group by item to handle multiple views of same item
        watched_data =
          Enum.reduce(watched_sessions, %{}, fn {item_id, pct}, acc ->
            Map.update(acc, item_id, pct, fn existing -> max(existing, pct) end)
      end)

        watched_item_ids = Map.keys(watched_data)

        # Get the embeddings for those items
        watched_items =
    Repo.all(
      from(i in Item,
              where: i.jellyfin_id in ^watched_item_ids and not is_nil(i.embedding)
      )
    )

        # If no watched items with embeddings, return empty list
        if Enum.empty?(watched_items) do
          []
        else
          # Calculate a weighted "user taste profile"
          weighted_embedding = weighted_average_embeddings(watched_items, watched_data)

          # Find similar items using the weighted embedding
          query = build_similarity_query(weighted_embedding, watched_item_ids, limit, genre_filter)
          similar_items = Repo.all(query)

          # Store in cache
          put_in_cache(cache_key, similar_items, @cache_ttl)

          similar_items
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
            query = build_similarity_query(item.embedding, [item_jellyfin_id], limit, genre_filter)
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
          find_similar_items(item.embedding, [item.jellyfin_id], limit)
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
      # Find users who watched this item
      users =
        Repo.all(
          from(s in PlaybackSession,
            where: s.item_jellyfin_id == ^item_jellyfin_id,
            select: s.user_id,
            distinct: true
          )
        )

      # Find other items these users watched
      other_items =
        Repo.all(
          from(s in PlaybackSession,
            where: s.user_id in ^users and s.item_jellyfin_id != ^item_jellyfin_id,
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
          where: i.jellyfin_id in ^item_ids,
          order_by: fragment("array_position(?, jellyfin_id)", ^item_ids)
        )
      )
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

  defp build_similarity_query(embedding, excluded_item_ids, limit, genre_filter) do
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

    # Calculate similarity directly in the final query
    from i in query,
      order_by: [asc: fragment("embedding <=> ?", ^embedding)],
      limit: ^limit,
      select: i
  end

  # Simple in-memory cache functions - could be replaced with Redis/Memcached in production
  defp get_from_cache(key) do
    case :persistent_term.get({__MODULE__, key}, :not_found) do
      :not_found -> nil
      {value, expiry} ->
        if :os.system_time(:second) < expiry, do: value, else: nil
    end
  rescue
    _ -> nil
  end

  defp put_in_cache(key, value, ttl) do
    expiry = :os.system_time(:second) + div(ttl, 1000)
    :persistent_term.put({__MODULE__, key}, {value, expiry})
  rescue
    _ -> :ok
  end

  defp find_similar_items(embedding, excluded_item_ids, limit) do
    # Use the pgvector extension to find similar items by cosine similarity
    Repo.all(
      from(i in Item,
        where: i.jellyfin_id not in ^excluded_item_ids and not is_nil(i.embedding),
        order_by: fragment("embedding <=> ?", ^embedding),
        limit: ^limit,
        select: i
      )
    )
  end

  defp average_embeddings(items) do
    # Extract embeddings and convert to lists for manipulation
    embedding_lists =
      Enum.map(items, fn item ->
        # Convert Pgvector to list if it's not already
        if is_list(item.embedding) do
          item.embedding
        else
          # Extract vector values from the Pgvector struct
          # This assumes Pgvector exposes a way to access the raw values
          # If not, check the Pgvector library documentation for the correct approach
          Pgvector.to_list(item.embedding)
        end
      end)

    # Calculate the dimensionality (length of first embedding)
    [first | _] = embedding_lists
    dims = length(first)

    # Initialize an accumulator with zeros
    zeros = List.duplicate(0.0, dims)

    # Sum the vectors
    summed =
      Enum.reduce(embedding_lists, zeros, fn embedding, acc ->
        Enum.zip_with(embedding, acc, fn e1, e2 -> e1 + e2 end)
      end)

    # Divide by count to get average
    count = length(embedding_lists)

    # Create the averaged vector
    averaged = Enum.map(summed, fn value -> value / count end)

    # Convert back to Pgvector format
    Pgvector.new(averaged)
  end
end
