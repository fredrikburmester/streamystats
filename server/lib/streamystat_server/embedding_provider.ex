defmodule StreamystatServer.EmbeddingProvider do
  @callback embed(text :: String.t(), token :: String.t() | nil) :: {:ok, [float()]} | {:error, any()}
  @callback embed_batch(texts :: [String.t()], token :: String.t() | nil) :: {:ok, [[float()]]} | {:error, any()}
end
