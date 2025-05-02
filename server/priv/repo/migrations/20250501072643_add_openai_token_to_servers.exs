defmodule StreamystatServer.Repo.Migrations.AddOpenaiTokenToServers do
  use Ecto.Migration

  def change do
    alter table(:servers) do
      add :open_ai_api_token, :string
    end
  end
end
