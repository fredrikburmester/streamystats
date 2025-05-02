defmodule StreamystatServer.Repo.Migrations.AddPeopleToJellyfinItems do
  use Ecto.Migration

  def change do
    alter table(:jellyfin_items) do
      add :people, {:array, :map}
    end
  end
end
