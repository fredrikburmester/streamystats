defmodule StreamystatServerWeb.UserJSON do
  alias StreamystatServer.Jellyfin.Models.User

  def index(%{users: users_with_details}) do
    %{data: for(user_data <- users_with_details, do: data(user_data, :index))}
  end

  def show(params) do
    %{data: data(params, :show)}
  end

  def me(%{user: user}) do
    %{
      id: user["Id"],
      name: user["Name"],
      server_id: user["ServerId"],
      primary_image_tag: user["PrimaryImageTag"],
      has_password: user["HasPassword"],
      has_configured_password: user["HasConfiguredPassword"],
      last_login_date: user["LastLoginDate"],
      last_activity_date: user["LastActivityDate"],
      configuration: user["Configuration"],
      is_administrator: user["IsAdministrator"]
    }
  end

  defp data(params, view) do
    base_data(params)
    |> add_view_specific_data(params, view)
  end

  defp base_data(%{user: %User{} = user}) do
    %{
      jellyfin_id: user.jellyfin_id,
      server_id: user.server_id,
      name: user.name,
      is_administrator: user.is_administrator
    }
  end

  defp add_view_specific_data(base, params, :index) do
    base
    |> Map.put(:watch_stats, watch_stats(params))
  end

  defp add_view_specific_data(base, params, :show) do
    base
    |> Map.put(:watch_stats, watch_stats(params))
    |> Map.put(:watch_history, params[:watch_history] || [])
    |> Map.put(:watch_time_per_day, params[:watch_time_per_day] || [])
    |> Map.put(:watch_time_per_weekday, params[:watch_time_per_weekday] || [])
    |> Map.put(:genre_stats, params[:genre_stats] || [])
    |> Map.put(:longest_streak, params[:longest_streak] || 0)
  end

  defp watch_stats(%{watch_stats: watch_stats}) do
    %{
      total_watch_time: watch_stats.total_watch_time,
      total_plays: watch_stats.total_plays
    }
  end

  defp watch_stats(_), do: %{total_watch_time: 0, total_plays: 0}
end
