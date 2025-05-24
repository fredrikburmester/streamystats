defmodule StreamystatServer.EmbeddingProvider.Ollama do
  @behaviour StreamystatServer.EmbeddingProvider
  require Logger

  @default_base_url "http://localhost:11434"
  @default_model "nomic-embed-text"

  # Rate limiting and backoff configuration
  @max_retries 5
  @initial_backoff 1000
  @max_backoff 60_000

  # Expected dimension for compatibility with database schema (OpenAI standard)
  @target_dimension 1536

  # Known model dimensions - only include models we explicitly support
  @model_dimensions %{
    # Nomic models
    "nomic-embed-text" => 768,
    "nomic-embed-text-v1" => 768,
    "nomic-embed-text-v1.5" => 768,

    # All-MiniLM models
    "all-minilm" => 384,
    "all-minilm:l6-v2" => 384,
    "all-minilm:33m" => 384,
    "all-minilm:22m" => 384,

    # BGE models
    "bge-large" => 1024,
    "bge-base" => 768,
    "bge-small" => 384,
    "bge-m3" => 1024,

    # MxBai models
    "mxbai-embed-large" => 1024,
    "mxbai-embed-large-v1" => 1024,

    # Snowflake Arctic models
    "snowflake-arctic-embed" => 1024,  # default 335m variant
    "snowflake-arctic-embed:335m" => 1024,
    "snowflake-arctic-embed:137m" => 1024,
    "snowflake-arctic-embed:110m" => 1024,
    "snowflake-arctic-embed:33m" => 1024,
    "snowflake-arctic-embed:22m" => 1024,
    "snowflake-arctic-embed2" => 1024,
    "snowflake-arctic-embed2:568m" => 1024,

    # Granite models
    "granite-embedding" => 768,  # default 278m variant
    "granite-embedding:278m" => 768,
    "granite-embedding:30m" => 768
  }

  @impl true
  def embed(text, opts \\ [])

  def embed(text, opts) when is_binary(text) and byte_size(text) > 0 do
    {base_url, model, token} = extract_opts(opts)

    url = "#{base_url}/api/embeddings"

    headers = build_headers(token)

    body = Jason.encode!(%{
      "model" => model,
      "prompt" => text
    })

    case do_request(url, headers, body, 0, @initial_backoff) do
      {:ok, embedding} -> {:ok, pad_embedding(embedding, model)}
      error -> error
    end
  end

  def embed("", _opts) do
    Logger.warning("Empty text provided for embedding")
    {:error, "Cannot embed empty text"}
  end

  def embed(nil, _opts) do
    Logger.warning("Nil text provided for embedding")
    {:error, "Cannot embed nil text"}
  end

  @impl true
  def embed_batch(texts, opts \\ []) when is_list(texts) do
    {base_url, model, token} = extract_opts(opts)

    # Filter out empty or nil texts
    valid_texts = Enum.filter(texts, fn text ->
      is_binary(text) and byte_size(text) > 0
    end)

    if Enum.empty?(valid_texts) do
      Logger.warning("No valid texts provided for batch embedding")
      {:error, "No valid texts provided for batch embedding"}
    else
      # Ollama doesn't have native batch support, so we'll process individually
      # but with controlled concurrency
      results =
        valid_texts
        |> Task.async_stream(
          fn text -> embed(text, opts) end,
          max_concurrency: 3,
          timeout: 30_000
        )
        |> Enum.to_list()

      # Check if all succeeded
      case Enum.split_with(results, fn {status, _} -> status == :ok end) do
        {successes, []} ->
          embeddings = Enum.map(successes, fn {:ok, {:ok, embedding}} -> embedding end)
          {:ok, embeddings}

        {_successes, failures} ->
          error_reasons = Enum.map(failures, fn
            {:ok, {:error, reason}} -> reason
            {:exit, reason} -> "Task failed: #{inspect(reason)}"
          end)
          {:error, "Some embeddings failed: #{inspect(error_reasons)}"}
      end
    end
  end

  # Pad embedding to target dimension (1536) for database compatibility
  defp pad_embedding(embedding, model) when is_list(embedding) do
    current_length = length(embedding)
    expected_dimension = get_model_dimension(model)

    cond do
      current_length == @target_dimension ->
        # Already correct size
        embedding

      current_length == expected_dimension ->
        # Expected size for this model, pad to target dimension
        padding_size = @target_dimension - current_length
        padding = List.duplicate(0.0, padding_size)
        embedding ++ padding

      current_length < @target_dimension ->
        # Generic padding for any smaller dimension
        Logger.warning("Embedding dimension (#{current_length}) smaller than expected for model '#{model}' (expected: #{expected_dimension}), padding to #{@target_dimension}")
        padding_size = @target_dimension - current_length
        padding = List.duplicate(0.0, padding_size)
        embedding ++ padding

      true ->
        # Embedding is larger than expected, truncate with warning
        Logger.warning("Embedding dimension (#{current_length}) larger than target (#{@target_dimension}), truncating")
        Enum.take(embedding, @target_dimension)
    end
  end

  defp pad_embedding(embedding, _model) do
    Logger.error("Invalid embedding format: #{inspect(embedding)}")
    embedding
  end

  # Get the expected dimension for a model
  defp get_model_dimension(model) do
    case Map.get(@model_dimensions, model) do
      nil ->
        Logger.warning("Unknown model '#{model}', assuming dimension #{@target_dimension}")
        @target_dimension
      dimension ->
        dimension
    end
  end

  # Get all supported models with their dimensions
  def get_supported_models do
    @model_dimensions
  end

  # Check if a model is supported
  def is_model_supported?(model) do
    Map.has_key?(@model_dimensions, model)
  end

  # Extract configuration from opts (can be a list or server struct)
  defp extract_opts(opts) when is_list(opts) do
    base_url = Keyword.get(opts, :base_url, @default_base_url)
    model = Keyword.get(opts, :model, @default_model)
    token = Keyword.get(opts, :token)
    {base_url, model, token}
  end

  defp extract_opts(%{ollama_base_url: base_url, ollama_model: model, ollama_api_token: token}) do
    {base_url || @default_base_url, model || @default_model, token}
  end

  defp extract_opts(opts) when is_binary(opts) do
    # Legacy support - treat as token
    {@default_base_url, @default_model, opts}
  end

  defp extract_opts(_) do
    {@default_base_url, @default_model, nil}
  end

  defp build_headers(nil), do: [{"Content-Type", "application/json"}]
  defp build_headers(token) do
    [
      {"Authorization", "Bearer #{token}"},
      {"Content-Type", "application/json"}
    ]
  end

  defp do_request(url, headers, body, retry_count, backoff) when retry_count <= @max_retries do
    case HTTPoison.post(url, body, headers, timeout: 30_000) do
      {:ok, %HTTPoison.Response{status_code: 200, body: resp_body}} ->
        case Jason.decode!(resp_body) do
          %{"embedding" => embedding} when is_list(embedding) ->
            {:ok, embedding}

          other ->
            Logger.error("Unexpected Ollama response format: #{inspect(other)}")
            {:error, "Unexpected Ollama response format"}
        end

      {:ok, %HTTPoison.Response{status_code: 429}} ->
        # Rate limit exceeded - back off and retry
        Logger.warning(
          "Ollama rate limit exceeded. Backing off for #{backoff}ms before retry #{retry_count + 1}/#{@max_retries}"
        )

        :timer.sleep(backoff)
        next_backoff = min(backoff * 2, @max_backoff)
        do_request(url, headers, body, retry_count + 1, next_backoff)

      {:ok, %HTTPoison.Response{status_code: code, body: _resp_body}}
      when code in [500, 502, 503, 504] ->
        # Server error - back off and retry
        Logger.warning(
          "Ollama server error (#{code}). Backing off for #{backoff}ms before retry #{retry_count + 1}/#{@max_retries}"
        )

        :timer.sleep(backoff)
        next_backoff = min(backoff * 2, @max_backoff)
        do_request(url, headers, body, retry_count + 1, next_backoff)

      {:ok, %HTTPoison.Response{status_code: code, body: resp_body}} ->
        error_message =
          case Jason.decode(resp_body) do
            {:ok, %{"error" => message}} when is_binary(message) -> message
            {:ok, %{"error" => %{"message" => message}}} -> message
            {:ok, error_body} -> inspect(error_body)
            {:error, _} -> "Invalid JSON response"
          end

        Logger.error("Ollama API error (#{code}): #{error_message}")
        {:error, "Ollama API error: #{code} - #{error_message}"}

      {:error, %HTTPoison.Error{reason: :timeout}} ->
        Logger.warning(
          "Ollama request timeout. Backing off for #{backoff}ms before retry #{retry_count + 1}/#{@max_retries}"
        )

        :timer.sleep(backoff)
        next_backoff = min(backoff * 2, @max_backoff)
        do_request(url, headers, body, retry_count + 1, next_backoff)

      {:error, %HTTPoison.Error{reason: :econnrefused}} ->
        Logger.error("Cannot connect to Ollama server at #{url}. Is Ollama running?")
        {:error, "Cannot connect to Ollama server. Please ensure Ollama is running and accessible."}

      {:error, %HTTPoison.Error{reason: reason}} ->
        if retry_count < @max_retries do
          Logger.warning(
            "HTTP request failed: #{inspect(reason)}. Backing off for #{backoff}ms before retry #{retry_count + 1}/#{@max_retries}"
          )

          :timer.sleep(backoff)
          next_backoff = min(backoff * 2, @max_backoff)
          do_request(url, headers, body, retry_count + 1, next_backoff)
        else
          Logger.error("HTTP request failed after #{@max_retries} retries: #{inspect(reason)}")
          {:error, "HTTP request failed: #{inspect(reason)}"}
        end

      error ->
        Logger.error("Unexpected error: #{inspect(error)}")
        {:error, "Unexpected error: #{inspect(error)}"}
    end
  end

  defp do_request(_url, _headers, _body, _retry_count, _backoff) do
    Logger.error("Ollama API request failed after maximum retry attempts")
    {:error, "Ollama API request failed after maximum retry attempts"}
  end
end
