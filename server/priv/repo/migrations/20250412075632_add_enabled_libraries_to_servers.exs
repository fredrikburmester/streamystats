defmodule StreamystatServer.Repo.Migrations.AddEnabledLibrariesToServers do
  use Ecto.Migration

  def change do
    alter table(:servers) do
      add :enabled_libraries, {:array, :string}, default: [], null: false
    end
  end
end
