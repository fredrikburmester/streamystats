defmodule StreamystatServerWeb.ActiveSessionsController do
  use StreamystatServerWeb, :controller
  require Logger
  alias StreamystatServer.Servers.Models.Server
  alias StreamystatServer.Repo
  alias StreamystatServer.Jellyfin.Models.User
  alias StreamystatServer.Jellyfin.Models.Item

  def index(conn, %{"server_id" => server_id}) do
    current_user = conn.assigns.current_user
    
    # NOTE: This functionality has been moved to the NextJS API route app/app/api/Sessions/route.ts
    # The frontend now fetches sessions directly from Jellyfin
    # This endpoint is kept for backward compatibility but returns an empty list
    
    render(conn, :index, active_sessions: [])
  end

  defp is_admin?(user) do
    user["Policy"]["IsAdministrator"] == true
  end
end