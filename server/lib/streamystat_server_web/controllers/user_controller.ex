defmodule StreamystatServerWeb.UserController do
  use StreamystatServerWeb, :controller
  alias StreamystatServer.Contexts.Users
  require Logger

  def index(conn, %{"server_id" => server_id}) do
    users = Users.get_users(server_id)

    users_with_details =
      Enum.map(users, fn user ->
        watch_stats = Users.get_user_watch_stats(server_id, user.jellyfin_id)
        %{user: user, watch_stats: watch_stats}
      end)

    render(conn, :index, users: users_with_details)
  end

  def show(conn, %{"server_id" => server_id, "id" => user_id} = params) do
    case Users.get_user(server_id, user_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> put_view(StreamystatServerWeb.ErrorJSON)
        |> render(:"404")

      user ->
        watch_stats = Users.get_user_watch_stats(server_id, user.jellyfin_id)
        watch_time_per_day = Users.get_user_watch_time_per_day(server_id, user.jellyfin_id)
        watch_time_per_weekday = Users.get_user_watch_time_per_weekday(server_id, user.jellyfin_id)
        genre_stats = Users.get_user_genre_watch_time(server_id, user.jellyfin_id)
        longest_streak = Users.get_user_longest_streak(user.jellyfin_id)
        watch_history = Users.get_user_watch_history(server_id, user.jellyfin_id, params)

        render(conn, :show,
          user: user,
          watch_stats: watch_stats,
          watch_time_per_day: watch_time_per_day,
          watch_time_per_weekday: watch_time_per_weekday,
          genre_stats: genre_stats,
          longest_streak: longest_streak,
          watch_history: watch_history
        )
    end
  end
end
