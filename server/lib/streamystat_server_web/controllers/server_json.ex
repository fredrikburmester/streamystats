defmodule StreamystatServerWeb.ServerJSON do
  alias StreamystatServer.Servers.Models.Server

  @doc """
  Renders a single server.
  """
  def show(%{server: server}) do
    %{data: data(server)}
  end

  @doc """
  Renders a list of servers.
  """
  def index(%{servers: servers}) do
    %{data: for(server <- servers, do: data(server))}
  end

  defp data(%Server{} = server) do
    %{
      id: server.id,
      name: server.name,
      url: server.url,
      api_key: server.api_key,
      inserted_at: server.inserted_at,
      updated_at: server.updated_at,
      enabled_libraries: server.enabled_libraries
    }
  end
end
