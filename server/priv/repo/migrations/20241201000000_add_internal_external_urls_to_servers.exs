defmodule StreamystatServer.Repo.Migrations.AddInternalExternalUrlsToServers do
  use Ecto.Migration

  def up do
    alter table(:servers) do
      add(:internal_url, :string)
      add(:external_url, :string)
    end

    # Migrate existing URLs to internal_url field for backward compatibility
    execute("""
      UPDATE servers SET internal_url = url WHERE internal_url IS NULL;
    """)

    execute("""
      UPDATE servers SET external_url = url WHERE external_url IS NULL;
    """)
  end

  def down do
    alter table(:servers) do
      remove(:internal_url)
      remove(:external_url)
    end
  end
end
