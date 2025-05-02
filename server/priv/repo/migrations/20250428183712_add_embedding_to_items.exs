defmodule YourApp.Repo.Migrations.AddEmbeddingToItems do
  use Ecto.Migration

  def change do
    alter table(:jellyfin_items) do
      add :embedding, :vector, size: 1536
    end
  end
end
