defmodule StreamystatServerWeb.RecommendationController do
  use StreamystatServerWeb, :controller
  alias StreamystatServer.SessionAnalysis
  alias StreamystatServer.Repo
  alias StreamystatServer.Sessions.Models.PlaybackSession
  alias StreamystatServer.Jellyfin.Models.Item
  import Ecto.Query
  require Logger

  @doc """
  Returns recommendations based on user's viewing history
  """
  def for_me(conn, params) do
    user_id = get_user_id(conn)
    limit = Map.get(params, "limit", "10") |> parse_limit()

    recommendations = SessionAnalysis.find_similar_items_for_user(user_id, limit)

    conn
    |> put_status(:ok)
    |> render(:recommendations, items: recommendations)
  end

  @doc """
  Returns items similar to a specific item
  """
  def similar_to(conn, %{"item_id" => item_jellyfin_id} = params) do
    user_id = get_user_id(conn)
    limit = Map.get(params, "limit", "10") |> parse_limit()

    # First check if the user has access to this item
    has_access = user_has_access_to_item?(user_id, item_jellyfin_id)

    if has_access do
      recommendations = SessionAnalysis.find_similar_items_to_item(item_jellyfin_id, limit)

      conn
      |> put_status(:ok)
      |> render(:recommendations, items: recommendations)
    else
      conn
      |> put_status(:forbidden)
      |> render(:error, error: "You don't have access to this item")
    end
  end

  @doc """
  Returns recommendations based on what the user is currently watching
  """
  def current_session(conn, %{"session_id" => session_id} = params) do
    user_id = get_user_id(conn)
    limit = Map.get(params, "limit", "10") |> parse_limit()

    # Check if this session belongs to the user
    session_id = parse_id(session_id)

    session_exists =
      Repo.exists?(
        from(s in PlaybackSession,
          where: s.id == ^session_id and s.user_id == ^user_id
        )
      )

    if session_exists do
      recommendations = SessionAnalysis.find_similar_items_for_session(session_id, limit)

      conn
      |> put_status(:ok)
      |> render(:recommendations, items: recommendations)
    else
      conn
      |> put_status(:forbidden)
      |> render(:error, error: "Session not found or doesn't belong to you")
    end
  end

  @doc """
  Returns "people who watched this also watched" recommendations
  """
  def others_watched(conn, %{"item_id" => item_jellyfin_id} = params) do
    user_id = get_user_id(conn)
    limit = Map.get(params, "limit", "10") |> parse_limit()

    # Check if the user has access to this item
    has_access = user_has_access_to_item?(user_id, item_jellyfin_id)

    if has_access do
      recommendations = SessionAnalysis.find_items_from_similar_sessions(item_jellyfin_id, limit)

      conn
      |> put_status(:ok)
      |> render(:recommendations, items: recommendations)
    else
      conn
      |> put_status(:forbidden)
      |> render(:error, error: "You don't have access to this item")
    end
  end

  # Private helper functions

  defp get_user_id(conn) do
    conn.assigns[:current_user_id]
  end

  defp parse_limit(limit) when is_binary(limit) do
    case Integer.parse(limit) do
      {num, _} when num > 0 and num <= 100 -> num
      # Default to 10 if invalid
      _ -> 10
    end
  end

  defp parse_limit(limit) when is_integer(limit) do
    if limit > 0 and limit <= 100, do: limit, else: 10
  end

  defp parse_limit(_), do: 10

  defp parse_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {num, _} -> num
      # Use invalid ID if parsing fails
      _ -> -1
    end
  end

  defp parse_id(id) when is_integer(id), do: id
  defp parse_id(_), do: -1

  defp user_has_access_to_item?(user_id, item_jellyfin_id) do
    # Check if the user has ever watched this item
    has_watched =
      Repo.exists?(
        from(s in PlaybackSession,
          where: s.user_id == ^user_id and s.item_jellyfin_id == ^item_jellyfin_id
        )
      )

    if has_watched do
      true
    else
      # If the user hasn't watched it, check if the item is public
      # This logic would need to be customized based on your access control system
      # Here we're assuming all items are accessible if they exist
      Repo.exists?(from(i in Item, where: i.jellyfin_id == ^item_jellyfin_id))
    end
  end
end
