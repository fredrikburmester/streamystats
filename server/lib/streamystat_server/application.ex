defmodule StreamystatServer.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    # Initialize ETS tables for tracking
    # Use try/catch to handle potential issues with table creation
    try do
      :ets.new(:embedding_progress, [:set, :public, :named_table])
      :ets.new(:embedding_process_registry, [:set, :public, :named_table])
      :ets.new(:recommendation_cache, [:set, :public, :named_table])
    catch
      :error, :badarg ->
        # Tables might already exist, which is fine
        :ok
    end

    # Set up for clean shutdown
    Process.flag(:trap_exit, true)

    children = [
      StreamystatServerWeb.Telemetry,
      StreamystatServer.Repo,
      {DNSCluster,
       query: Application.get_env(:streamystat_server, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: StreamystatServer.PubSub},
      {Finch, name: StreamystatServer.Finch},
      StreamystatServerWeb.Endpoint,
      StreamystatServer.Workers.SyncTask,
      # Removed SessionPoller since NextJS now fetches sessions directly from Jellyfin
      StreamystatServer.Workers.TautulliImporter,
      StreamystatServer.Workers.JellystatsImporter,
      StreamystatServer.Workers.PlaybackReportingImporter,
      StreamystatServer.Workers.AutoEmbedder,
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

  @impl true
  def start_full_sync do
    # Start a sync after a delay to let system boot up
    Process.sleep(30_000)
    StreamystatServer.Workers.SyncTask.sync_all()
  end
end
