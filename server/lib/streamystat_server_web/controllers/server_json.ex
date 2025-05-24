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
      open_ai_api_token: server.open_ai_api_token,
      auto_generate_embeddings: server.auto_generate_embeddings,
      inserted_at: server.inserted_at,
      updated_at: server.updated_at,
      ollama_api_token: server.ollama_api_token,
      ollama_base_url: server.ollama_base_url,
      ollama_model: server.ollama_model,
      embedding_provider: server.embedding_provider
    }
  end
end
