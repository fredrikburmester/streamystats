defmodule StreamystatServer.Workers.SyncTask do
  use GenServer
  alias StreamystatServer.Jellyfin.Sync
  alias StreamystatServer.Servers.SyncLog
  alias StreamystatServer.Servers.Servers

  alias StreamystatServer.Repo
  require Logger

  @type server_id :: String.t()
  @type sync_type :: String.t()
  @type sync_result :: {:ok, Server.t()} | {:error, atom()}

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    {:ok, task_supervisor} = Task.Supervisor.start_link()
    schedule_full_sync()
    schedule_recently_added_sync()
    schedule_embedding_job()
    {:ok, %{task_supervisor: task_supervisor}}
  end

  @doc """
  Trigger a full sync for a specific server
  """
  @spec full_sync(server_id()) :: :ok
  def full_sync(server_id), do: GenServer.cast(__MODULE__, {:full_sync, server_id})

  @doc """
  Sync users for a specific server
  """
  @spec sync_users(server_id()) :: :ok
  def sync_users(server_id), do: GenServer.cast(__MODULE__, {:sync_users, server_id})

  @doc """
  Sync libraries for a specific server
  """
  @spec sync_libraries(server_id()) :: :ok
  def sync_libraries(server_id), do: GenServer.cast(__MODULE__, {:sync_libraries, server_id})

  @doc """
  Sync items for a specific server
  """
  @spec sync_items(server_id()) :: :ok
  def sync_items(server_id), do: GenServer.cast(__MODULE__, {:sync_items, server_id})

  @doc """
  Sync recent activities for a specific server
  """
  @spec sync_recent_activities(server_id()) :: :ok
  def sync_recent_activities(server_id),
    do: GenServer.cast(__MODULE__, {:sync_recent_activities, server_id})

  @doc """
  Sync all activities for a specific server
  """
  @spec sync_activities(server_id()) :: :ok
  def sync_activities(server_id),
    do: GenServer.cast(__MODULE__, {:sync_activities, server_id})

  @doc """
  Sync recently added items for a specific server
  """
  @spec sync_recently_added_items(server_id()) :: :ok
  def sync_recently_added_items(server_id),
    do: GenServer.cast(__MODULE__, {:sync_recently_added_items, server_id})

  @impl true
  def handle_cast({sync_type, server_id}, %{task_supervisor: supervisor} = state)
      when sync_type in [
             :full_sync,
             :sync_users,
             :sync_libraries,
             :sync_items,
             :sync_recent_activities,
             :sync_activities,
             :sync_recently_added_items
           ] do
    Task.Supervisor.async_nolink(supervisor, fn ->
      perform_sync(sync_type, server_id)
    end)

    {:noreply, state}
  end

  @impl true
  def handle_info({ref, _result}, state) do
    Process.demonitor(ref, [:flush])
    {:noreply, state}
  end

  @impl true
  def handle_info(:sync_recently_added, %{task_supervisor: supervisor} = state) do
    Task.Supervisor.async_nolink(supervisor, fn ->
      Servers.list_servers()
      |> Enum.each(fn server ->
        perform_sync(:sync_recently_added_items, server.id)
      end)
    end)

    schedule_recently_added_sync()
    {:noreply, state}
  end

  @impl true
  def handle_info(:run_embeddings, %{task_supervisor: supervisor} = state) do
    Task.Supervisor.async_nolink(supervisor, fn ->
      try_embed_items()
    end)

    schedule_embedding_job()
    {:noreply, state}
  end

  @impl true
  def handle_info(:sync, %{task_supervisor: supervisor} = state) do
    Task.Supervisor.async_nolink(supervisor, fn ->
      Servers.list_servers()
      |> Enum.each(fn server ->
        perform_sync(:full_sync, server.id)
      end)
    end)

    schedule_full_sync()
    {:noreply, state}
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, _pid, _reason}, state) do
    {:noreply, state}
  end

  # Private functions

  defp schedule_embedding_job do
    # Run every hour
    Process.send_after(self(), :run_embeddings, 60 * 60 * 1000)
  end

  defp perform_sync(sync_type, server_id) do
    with {:ok, server} <- get_server(server_id) do
      sync_log = create_sync_log(server_id, Atom.to_string(sync_type))
      Logger.info("#{sync_type} started for server #{server.name}")

      try do
        result =
          case sync_type do
            :full_sync ->
              perform_full_sync(server)

            :sync_users ->
              {result, _metrics} = Sync.sync_users(server)
              result

            :sync_libraries ->
              {result, _metrics} = Sync.sync_libraries(server)
              result

            :sync_items ->
              {result, metrics} = Sync.sync_items(server)

              # Log metrics for items sync
              Logger.info("""
              Items sync metrics for server #{server.name}:
              Libraries processed: #{metrics.libraries_processed}
              Items processed: #{metrics.items_processed}
              API requests: #{metrics.api_requests}
              Database operations: #{metrics.database_operations}
              """)

              result

            :sync_activities ->
              {result, metrics} = Sync.sync_activities(server)

              # Log metrics for activities sync
              Logger.info("""
              Activities sync metrics for server #{server.name}:
              Activities processed: #{metrics.activities_processed}
              Activities inserted: #{metrics.activities_inserted}
              API requests: #{metrics.api_requests}
              Database operations: #{metrics.database_operations}
              """)

              result

            :sync_recently_added_items ->
              case Sync.sync_recently_added_items(server, 50) do
                # New format with unchanged items count
                {{:ok, inserted, _updated, _unchanged}, _metrics} ->
                  {:ok, inserted}

                # Original format for backward compatibility
                {{:ok, inserted, _updated}, _metrics} ->
                  {:ok, inserted}

                # New partial format with unchanged items count
                {{:partial, inserted, _updated, _unchanged, _errors}, _metrics} ->
                  {:partial, inserted}

                # Original partial format for backward compatibility
                {{:partial, inserted, _updated, _errors}, _metrics} ->
                  {:partial, inserted}

                {{:error, reason}, _metrics} ->
                  {:error, reason}

                _other ->
                  {:error, :unexpected_result}
              end

            :sync_recent_activities ->
              {result, metrics} = Sync.sync_recent_activities(server)

              # Log metrics for recent activities sync
              Logger.info("""
              Recent activities sync metrics for server #{server.name}:
              Activities processed: #{metrics.activities_processed}
              Activities inserted: #{metrics.activities_inserted}
              API requests: #{metrics.api_requests}
              Database operations: #{metrics.database_operations}
              """)

              result

            _ ->
              Logger.error("Unknown sync type: #{sync_type}")
              update_sync_log(sync_log, :failed)
              {:error, :unknown_sync_type}
          end

        embedding_result = try_embed_items()

        # Store result details in the sync log
        status =
          case result do
            {:ok, _} -> :completed
            {:partial, _} -> :partial
            {:error, _} -> :failed
            _ -> :failed
          end

        Logger.info("#{sync_type} completed for server #{server.name} with status: #{status}")

        if embedding_result != :ok do
          Logger.warning("Embeddings generation had some issues after sync")
        end

        Logger.info("#{sync_type} completed for server #{server.name} with status: #{status}")
        update_sync_log(sync_log, status)
        {:ok, server}
      rescue
        e ->
          Logger.error("Error during #{sync_type} for server #{server.name}: #{inspect(e)}")
          update_sync_log(sync_log, :failed)
          {:error, :sync_failed}
      end
    end
  end

  defp try_embed_items do
    try do
      StreamystatServer.BatchEmbedder.embed_all_items()
      :ok
    rescue
      e ->
        Logger.error("Error during embedding generation: #{inspect(e)}")
        Logger.error(Exception.format_stacktrace())
        :error
    catch
      kind, reason ->
        Logger.error("Caught #{kind} in embedding process: #{inspect(reason)}")
        Logger.error(Exception.format_stacktrace())
        :error
    end
  end

  defp schedule_recently_added_sync do
    # Every other minute
    Process.send_after(self(), :sync_recently_added, 60 * 1000 * 2)
  end

  @spec get_server(server_id()) :: {:ok, Servers.Server.t()} | {:error, :not_found}
  defp get_server(server_id) do
    case Servers.get_server(server_id) do
      nil ->
        Logger.error("Server with ID #{server_id} not found")
        {:error, :not_found}

      server ->
        {:ok, server}
    end
  end

  defp create_sync_log(server_id, sync_type) do
    %SyncLog{}
    |> SyncLog.changeset(%{
      server_id: server_id,
      sync_type: sync_type,
      sync_started_at: NaiveDateTime.utc_now()
    })
    |> Repo.insert!()
  end

  defp update_sync_log(sync_log, status) do
    sync_log
    |> SyncLog.changeset(%{
      sync_completed_at: NaiveDateTime.utc_now(),
      status: Atom.to_string(status)
    })
    |> Repo.update!()
  end

  defp schedule_full_sync do
    # Run every 24 hours
    Process.send_after(self(), :sync, 24 * 60 * 60 * 1000)
  end

  defp perform_full_sync(server) do
    # Run each sync operation and collect results
    # Users
    {users_result, _} = Sync.sync_users(server)
    Logger.info("Users sync completed with result: #{inspect(users_result)}")

    # Libraries
    {libraries_result, _} = Sync.sync_libraries(server)
    Logger.info("Libraries sync completed with result: #{inspect(libraries_result)}")

    # Items
    {items_result, items_metrics} = Sync.sync_items(server)

    Logger.info("""
    Items sync completed with result: #{inspect(items_result)}
    Items processed: #{items_metrics.items_processed}
    """)

    # Activities
    {activities_result, activities_metrics} = Sync.sync_activities(server)

    Logger.info("""
    Activities sync completed with result: #{inspect(activities_result)}
    Activities processed: #{activities_metrics.activities_processed}
    """)

    # Determine overall sync result
    cond do
      # If any sync operation failed completely
      users_result == :error or libraries_result == :error or
        items_result == :error or activities_result == :error ->
        {:error, :sync_failed}

      # If some operations completed partially
      match?({:partial, _, _}, users_result) or match?({:partial, _, _}, libraries_result) or
        match?({:partial, _, _}, items_result) or match?({:partial, _, _}, activities_result) ->
        {:partial, :some_operations_partial}

      # Everything succeeded
      true ->
        {:ok, :all_operations_succeeded}
    end
  end
end
