defmodule YourApp.Repo.Migrations.AddPgvectorExtension do
  use Ecto.Migration

  def change do
    execute("CREATE EXTENSION IF NOT EXISTS vector")
  end
end
