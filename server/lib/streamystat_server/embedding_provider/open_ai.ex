defmodule StreamystatServer.EmbeddingProvider.OpenAI do
  @behaviour StreamystatServer.EmbeddingProvider
  require Logger

  @url "https://api.openai.com/v1/embeddings"
  @model "text-embedding-ada-002"

  # Rate limiting and backoff configuration
  @max_retries 5
  # in milliseconds
  @initial_backoff 1000
  # 60 seconds max backoff
  @max_backoff 60_000

  @impl true
  def embed(text, token \\ nil)

  def embed(text, token) when is_binary(text) and byte_size(text) > 0 do
    api_token = token || System.get_env("OPENAI_API_KEY")

    if is_nil(api_token) or api_token == "" do
      Logger.error("OPENAI_API_KEY environment variable is not set or empty")

      {:error,
       "OpenAI API key not configured. Please set the OPENAI_API_KEY environment variable."}
    else
      headers = [
        {"Authorization", "Bearer #{api_token}"},
        {"Content-Type", "application/json"}
      ]

      body =
        Jason.encode!(%{
          "input" => text,
          "model" => @model
        })

      do_request(headers, body, 0, @initial_backoff)
    end
  end

  def embed("", _token) do
    Logger.warning("Empty text provided for embedding")
    {:error, "Cannot embed empty text"}
  end

  def embed(nil, _token) do
    Logger.warning("Nil text provided for embedding")
    {:error, "Cannot embed nil text"}
  end

  # Batch embedding for multiple texts
  @impl true
  def embed_batch(texts, token \\ nil) when is_list(texts) do
    api_token = token || System.get_env("OPENAI_API_KEY")

    if is_nil(api_token) or api_token == "" do
      Logger.error("OPENAI_API_KEY environment variable is not set or empty")

      {:error,
       "OpenAI API key not configured. Please set the OPENAI_API_KEY environment variable."}
    else
      # Filter out empty or nil texts
      valid_texts =
        Enum.filter(texts, fn text ->
          is_binary(text) and byte_size(text) > 0
        end)

      if Enum.empty?(valid_texts) do
        Logger.warning("No valid texts provided for batch embedding")
        {:error, "No valid texts provided for batch embedding"}
      else
        headers = [
          {"Authorization", "Bearer #{api_token}"},
          {"Content-Type", "application/json"}
        ]

        body =
          Jason.encode!(%{
            "input" => valid_texts,
            "model" => @model
          })

        case do_request(headers, body, 0, @initial_backoff) do
          {:ok, embeddings} -> {:ok, embeddings}
          error -> error
        end
      end
    end
  end

  # Helper for making requests with exponential backoff
  defp do_request(headers, body, retry_count, backoff) when retry_count <= @max_retries do
    case HTTPoison.post(@url, body, headers) do
      {:ok, %HTTPoison.Response{status_code: 200, body: resp_body}} ->
        case Jason.decode!(resp_body) do
          %{"data" => [%{"embedding" => embedding}]} ->
            {:ok, embedding}

          %{"data" => data} when is_list(data) ->
            # Handle batch response
            embeddings = Enum.map(data, fn %{"embedding" => embedding} -> embedding end)
            {:ok, embeddings}

          other ->
            Logger.error("Unexpected OpenAI response format: #{inspect(other)}")
            {:error, "Unexpected OpenAI response format"}
        end

      {:ok, %HTTPoison.Response{status_code: 429}} ->
        # Rate limit exceeded - back off and retry
        Logger.warning(
          "OpenAI rate limit exceeded. Backing off for #{backoff}ms before retry #{retry_count + 1}/#{@max_retries}"
        )

        :timer.sleep(backoff)
        next_backoff = min(backoff * 2, @max_backoff)
        do_request(headers, body, retry_count + 1, next_backoff)

      {:ok, %HTTPoison.Response{status_code: code, body: _resp_body}}
      when code in [500, 502, 503, 504] ->
        # Server error - back off and retry
        Logger.warning(
          "OpenAI server error (#{code}). Backing off for #{backoff}ms before retry #{retry_count + 1}/#{@max_retries}"
        )

        :timer.sleep(backoff)
        next_backoff = min(backoff * 2, @max_backoff)
        do_request(headers, body, retry_count + 1, next_backoff)

      {:ok, %HTTPoison.Response{status_code: code, body: resp_body}} ->
        # Safely extract error message with pattern matching
        error_message =
          case Jason.decode(resp_body) do
            {:ok, %{"error" => %{"message" => message}}} -> message
            {:ok, error_body} -> inspect(error_body)
            {:error, _} -> "Invalid JSON response"
          end

        Logger.error("OpenAI API error (#{code}): #{error_message}")
        {:error, "OpenAI API error: #{code} - #{error_message}"}

      {:error, %HTTPoison.Error{reason: :timeout}} ->
        # Timeout - back off and retry
        Logger.warning(
          "OpenAI request timeout. Backing off for #{backoff}ms before retry #{retry_count + 1}/#{@max_retries}"
        )

        :timer.sleep(backoff)
        next_backoff = min(backoff * 2, @max_backoff)
        do_request(headers, body, retry_count + 1, next_backoff)

      {:error, %HTTPoison.Error{reason: reason}} ->
        if retry_count < @max_retries do
          Logger.warning(
            "HTTP request failed: #{inspect(reason)}. Backing off for #{backoff}ms before retry #{retry_count + 1}/#{@max_retries}"
          )

          :timer.sleep(backoff)
          next_backoff = min(backoff * 2, @max_backoff)
          do_request(headers, body, retry_count + 1, next_backoff)
        else
          Logger.error("HTTP request failed after #{@max_retries} retries: #{inspect(reason)}")
          {:error, "HTTP request failed: #{inspect(reason)}"}
        end

      error ->
        Logger.error("Unexpected error: #{inspect(error)}")
        {:error, "Unexpected error: #{inspect(error)}"}
    end
  end

  defp do_request(_headers, _body, _retry_count, _backoff) do
    Logger.error("OpenAI API request failed after maximum retry attempts")
    {:error, "OpenAI API request failed after maximum retry attempts"}
  end
end
