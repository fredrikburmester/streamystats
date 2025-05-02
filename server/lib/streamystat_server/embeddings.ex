defmodule StreamystatServer.Embeddings do
  @provider Application.compile_env(:streamystat_server, :embedding_provider, StreamystatServer.EmbeddingProvider.OpenAI)

  def embed(text, token \\ nil) do
    @provider.embed(text, token)
  end
end
