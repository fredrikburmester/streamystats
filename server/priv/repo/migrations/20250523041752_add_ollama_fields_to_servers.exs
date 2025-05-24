defmodule StreamystatServer.Repo.Migrations.AddOllamaFieldsToServers do
  use Ecto.Migration

  def change do
    alter table(:servers) do
      add :ollama_api_token, :string
      add :ollama_base_url, :string, default: "http://localhost:11434"
      add :ollama_model, :string, default: "nomic-embed-text"
      add :embedding_provider, :string, default: "openai"
    end
  end
end
