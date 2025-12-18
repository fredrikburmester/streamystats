defmodule Streamystats.Repo.Migrations.ResetEmbeddingColumnForPgvector do
  use Ecto.Migration

  @disable_ddl_transaction true

  def up do
    # 1. Drop the embedding column if it exists
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'jellyfin_items' AND column_name = 'embedding'
      ) THEN
        ALTER TABLE jellyfin_items DROP COLUMN embedding;
      END IF;
    END$$;
    """)

    # 2. Drop the vector and vectors extensions if they exist
    execute("DROP EXTENSION IF EXISTS vector CASCADE;")
    execute("DROP EXTENSION IF EXISTS vectors CASCADE;")

    # 3. Drop any leftover types
    execute("DROP TYPE IF EXISTS vector CASCADE;")
    execute("DROP TYPE IF EXISTS old_vector CASCADE;")

    # 4. Create the official pgvector extension
    execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 5. Add the embedding column back with the correct type and size
    alter table(:jellyfin_items) do
      add :embedding, :vector, size: 1536
    end
  end

  def down do
    alter table(:jellyfin_items) do
      remove :embedding
    end
  end
end
