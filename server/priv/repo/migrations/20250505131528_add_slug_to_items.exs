defmodule StreamystatServer.Repo.Migrations.AddSlugToItems do
  use Ecto.Migration

  def up do
    alter table(:jellyfin_items) do
      add :slug, :string
    end

    # First, generate slugs for all movies and series
    execute """
    UPDATE jellyfin_items
    SET slug = btrim(lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')), '-')
    WHERE type IN ('Movie', 'Series')
    """

    # Then handle any duplicates by appending --[row_number]
    execute """
    WITH ranked AS (
      SELECT id, slug, server_id,
             ROW_NUMBER() OVER (PARTITION BY server_id, slug ORDER BY id) AS rn
      FROM jellyfin_items
      WHERE slug IS NOT NULL
    )
    UPDATE jellyfin_items
    SET slug = ranked.slug || '--' || ranked.rn
    FROM ranked
    WHERE jellyfin_items.id = ranked.id AND ranked.rn > 1
    """

    # Create unique index for non-null slugs
    create unique_index(:jellyfin_items, [:server_id, :slug], where: "slug IS NOT NULL")
  end

  def down do
    drop_if_exists index(:jellyfin_items, [:server_id, :slug])
    alter table(:jellyfin_items) do
      remove :slug
    end
  end
end 