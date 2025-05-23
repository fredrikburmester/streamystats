defmodule StreamystatServerWeb.ServerController do
  use StreamystatServerWeb, :controller
  import Ecto.Query
  alias StreamystatServer.Servers.Servers
  alias StreamystatServer.Servers.Models.Server
  alias StreamystatServer.BatchEmbedder
  alias StreamystatServer.Repo
  alias StreamystatServer.SessionAnalysis
  alias StreamystatServer.Items.Item
  require Logger

  def index(conn, _params) do
    servers = Servers.list_servers()
    render(conn, :index, servers: servers)
  end

  def create(conn, server_params) do
    case Servers.create_server(server_params) do
      {:ok, server} ->
        conn
        |> put_status(:created)
        |> render(:show, server: server)

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> put_view(json: StreamystatServerWeb.ChangesetJSON)
        |> render(:error, changeset: changeset)
    end
  end

  def show(conn, %{"id" => id}) do
    case Servers.get_server(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> put_view(StreamystatServerWeb.ErrorJSON)
        |> render("404.json", %{})

      server ->
        render(conn, :show, server: server)
    end
  end

  def update_settings(conn, %{"id" => id} = params) do
    settings_params = Map.drop(params, ["id"])
    embedding_config_updated = Map.has_key?(settings_params, "open_ai_api_token") ||
                              Map.has_key?(settings_params, "ollama_api_token") ||
                              Map.has_key?(settings_params, "ollama_base_url") ||
                              Map.has_key?(settings_params, "ollama_model") ||
                              Map.has_key?(settings_params, "embedding_provider")

    case Servers.get_server(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> put_view(StreamystatServerWeb.ErrorJSON)
        |> render("404.json", %{})

      server ->
        case Servers.update_server(server, settings_params) do
          {:ok, updated_server} ->
            # If embedding configuration was updated and auto-generate is enabled, start embedding process
            if embedding_config_updated && updated_server.auto_generate_embeddings do
              # Check if server has valid embedding configuration
              case validate_embedding_config(updated_server) do
                :ok ->
                  BatchEmbedder.start_embed_items_for_server(updated_server.id)
                {:error, reason} ->
                  Logger.warning("Could not start embedding process: #{reason}")
              end
            end

            render(conn, :show, server: updated_server)

          {:error, changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> put_view(json: StreamystatServerWeb.ChangesetJSON)
            |> render(:error, changeset: changeset)
        end
    end
  end

  defp validate_embedding_config(server) do
    case server.embedding_provider || "openai" do
      "openai" ->
        if server.open_ai_api_token do
          :ok
        else
          {:error, "OpenAI API token not configured"}
        end

      "ollama" ->
        if server.ollama_base_url && server.ollama_model do
          :ok
        else
          {:error, "Ollama configuration not set"}
        end

      _ ->
        {:error, "Invalid embedding provider"}
    end
  end

  def delete(conn, %{"server_id" => id}) do
    case Servers.delete_server(id) do
      {:ok, _} ->
        send_resp(conn, :no_content, "")

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: reason})
    end
  end

  def embedding_progress(conn, %{"server_id" => server_id}) do
    # Get embedding progress for the server
    progress = BatchEmbedder.get_progress(String.to_integer(server_id))

    # Calculate percentage if available
    percentage = if progress.total > 0 do
      Float.round(progress.processed / progress.total * 100, 1)
    else
      0.0
    end

    # Add percentage to the progress data
    progress_with_percentage = Map.put(progress, :percentage, percentage)

    conn
    |> json(%{data: progress_with_percentage})
  end

  def start_embedding(conn, %{"server_id" => server_id}) do
    server_id = String.to_integer(server_id)

    # Get the server to ensure it exists and has valid embedding configuration
    case Servers.get_server(server_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Server not found"})

      server ->
        case validate_embedding_config(server) do
          :ok ->
            case BatchEmbedder.start_embed_items_for_server(server_id) do
              {:ok, message} ->
                json(conn, %{message: message})

              {:error, error} ->
                conn
                |> put_status(:bad_request)
                |> json(%{error: error})
            end

          {:error, error} ->
            conn
            |> put_status(:bad_request)
            |> json(%{error: error})
        end
    end
  end

  def stop_embedding(conn, %{"server_id" => server_id}) do
    server_id = String.to_integer(server_id)

    case BatchEmbedder.stop_embed_items_for_server(server_id) do
      {:ok, message} ->
        json(conn, %{message: message})

      {:error, error} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: error})
    end
  end

  def clear_embeddings(conn, %{"id" => id}) do
    server = Repo.get(Server, id)

    case server do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Server not found"})

      _ ->
        case SessionAnalysis.remove_all_embeddings(server.id) do
          {:ok, count} ->
            # Get the updated counts after clearing
            total_movies_count =
              Repo.one(
                from(i in Item,
                  where: i.type == "Movie" and i.server_id == ^server.id,
                  select: count()
                )
              ) || 0

            # Movies with embeddings should be 0 after clearing
            BatchEmbedder.update_progress(server.id, total_movies_count, 0, "idle")
            json(conn, %{message: "Successfully cleared #{count} embeddings"})

          {:error, reason} ->
            conn
            |> put_status(:internal_server_error)
            |> json(%{error: reason})
        end
    end
  end
end
