defmodule StreamystatServer.EmbeddingProvider do
  @callback embed(text :: String.t()) :: {:ok, [float()]} | {:error, any()}
end
