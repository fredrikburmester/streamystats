defmodule StreamystatServer.Embeddings do
  alias StreamystatServer.EmbeddingProvider.OpenAI
  alias StreamystatServer.EmbeddingProvider.Ollama

  def embed(text, server_or_token \\ nil) do
    case get_provider_and_opts(server_or_token) do
      {provider, opts} -> provider.embed(text, opts)
      :error -> {:error, "No valid embedding configuration found"}
    end
  end

  def embed_batch(texts, server_or_token \\ nil) do
    case get_provider_and_opts(server_or_token) do
      {provider, opts} -> provider.embed_batch(texts, opts)
      :error -> {:error, "No valid embedding configuration found"}
    end
  end

  # Support for server struct
  defp get_provider_and_opts(%{embedding_provider: "ollama"} = server) do
    if server.ollama_base_url && server.ollama_model do
      {Ollama, server}
    else
      :error
    end
  end

  defp get_provider_and_opts(%{embedding_provider: "openai"} = server) do
    if server.open_ai_api_token do
      {OpenAI, server.open_ai_api_token}
    else
      :error
    end
  end

  defp get_provider_and_opts(%{open_ai_api_token: token} = server) when not is_nil(token) do
    # Backward compatibility for servers without embedding_provider field
    {OpenAI, token}
  end

  # Support for direct token (backward compatibility)
  defp get_provider_and_opts(token) when is_binary(token) do
    {OpenAI, token}
  end

  # Support for keyword list options
  defp get_provider_and_opts(opts) when is_list(opts) do
    provider = Keyword.get(opts, :provider, :openai)
    case provider do
      :openai -> {OpenAI, opts}
      :ollama -> {Ollama, opts}
      "openai" -> {OpenAI, opts}
      "ollama" -> {Ollama, opts}
      _ -> :error
    end
  end

  defp get_provider_and_opts(nil) do
    # Fallback to OpenAI with environment token
    if System.get_env("OPENAI_API_KEY") do
      {OpenAI, nil}
    else
      :error
    end
  end

  defp get_provider_and_opts(_), do: :error
end
