defmodule StreamystatServer.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    unless Mix.env() == :prod do
      Dotenv.load()
      Mix.Task.run("loadconfig")
    end

    children = [
      StreamystatServerWeb.Telemetry,
      StreamystatServer.Repo,
      {DNSCluster,
       query: Application.get_env(:streamystat_server, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: StreamystatServer.PubSub},
      {Finch, name: StreamystatServer.Finch},
      StreamystatServerWeb.Endpoint,
      StreamystatServer.Workers.SyncTask,
      StreamystatServer.Workers.SessionPoller,
      StreamystatServer.Workers.TautulliImporter,
      StreamystatServer.Workers.JellystatsImporter,
      StreamystatServer.Workers.PlaybackReportingImporter,
      {Task, &start_full_sync/0}
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: StreamystatServer.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    StreamystatServerWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  # Start a full sync for each server
  defp start_full_sync do
    servers = StreamystatServer.Jellyfin.Users.list_servers()

    Enum.each(servers, fn server ->
      StreamystatServer.Workers.SyncTask.full_sync(server.id)
    end)
  end
end
