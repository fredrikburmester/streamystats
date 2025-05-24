defmodule StreamystatServer.Workers.AutoEmbedder do
  use GenServer
  require Logger
  import Ecto.Query
  alias StreamystatServer.Repo
  alias StreamystatServer.Servers.Models.Server
  alias StreamystatServer.Jellyfin.Models.Item
  alias StreamystatServer.BatchEmbedder

  @interval_ms 60 * 60 * 1000 # 1 hour
  @initial_delay_ms 60 * 1000 # 1 minute

  def start_link(_) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  @impl true
  def init(state) do
    # Schedule the first check after initial delay
    schedule_check(@initial_delay_ms)
    {:ok, state}
  end

  @impl true
  def handle_info(:check_for_embeddings, state) do
    Logger.info("Running scheduled auto-embedding check")

    # Check if any servers have auto_generate_embeddings enabled before doing the full query
    has_auto_embed_servers =
      Repo.one(from(s in Server,
        where: s.auto_generate_embeddings == true and not is_nil(s.open_ai_api_token),
        select: count(s.id))) > 0

    if has_auto_embed_servers do
      auto_generate_embeddings()
    else
      Logger.info("No servers with auto_generate_embeddings enabled, skipping check")
    end

    schedule_check(@interval_ms)
    {:noreply, state}
  end

  defp schedule_check(interval) do
    Process.send_after(self(), :check_for_embeddings, interval)
  end

  def auto_generate_embeddings do
    # Find servers with auto_generate_embeddings enabled and valid embedding configuration
    servers_query = from(s in Server,
      where: s.auto_generate_embeddings == true and
             (not is_nil(s.open_ai_api_token) or
              not is_nil(s.ollama_base_url) or
              not is_nil(s.ollama_model)),
      select: s)

    servers_with_config = Repo.all(servers_query)

    if Enum.empty?(servers_with_config) do
      Logger.info("No servers with auto_generate_embeddings enabled and valid configuration")
    else
      Logger.info("Found #{length(servers_with_config)} server(s) with auto_generate_embeddings enabled")

      # Process each server
      Enum.each(servers_with_config, fn server ->
        # Check if embedding is already running for this server
        case BatchEmbedder.get_embedding_process(server.id) do
          nil ->
            # No current embedding process, check if there are new items without embeddings
            items_count =
              Repo.one(from(i in Item,
                where: is_nil(i.embedding) and
                      i.type == "Movie" and
                      i.server_id == ^server.id,
                select: count()))

            if items_count > 0 do
              Logger.info("Starting auto-embedding for server #{server.id}, #{items_count} items need embeddings")
              BatchEmbedder.start_embed_items_for_server(server.id)
            else
              Logger.info("No new items to embed for server #{server.id}")
            end

          pid ->
            # Process already running
            if Process.alive?(pid) do
              Logger.info("Embeddings already running for server #{server.id}")
            else
              # Process is dead but not unregistered, clean up and start a new one
              BatchEmbedder.unregister_embedding_process(server.id)
              auto_generate_embeddings()
            end
        end
      end)
    end
  end
end
