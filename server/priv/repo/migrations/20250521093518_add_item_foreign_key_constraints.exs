defmodule StreamystatServer.Repo.Migrations.AddItemForeignKeyConstraints do
  use Ecto.Migration

  def up do
    # First ensure we have the correct indexes
    create_if_not_exists index(:playback_sessions, [:item_jellyfin_id])
    create_if_not_exists index(:activities, [:item_jellyfin_id])

    # Only create placeholder if we have servers and libraries
    execute """
    INSERT INTO jellyfin_items (jellyfin_id, name, type, library_id, server_id, inserted_at, updated_at)
    SELECT '__PLACEHOLDER_ID__', 'Placeholder Item', 'placeholder',
           s.min_server_id, l.min_library_id, NOW(), NOW()
    FROM (SELECT MIN(id) as min_server_id FROM servers WHERE id IS NOT NULL) s
    CROSS JOIN (SELECT MIN(id) as min_library_id FROM jellyfin_libraries WHERE id IS NOT NULL) l
    WHERE s.min_server_id IS NOT NULL AND l.min_library_id IS NOT NULL
    ON CONFLICT (jellyfin_id) DO NOTHING
    """

    # Update orphaned references to use the placeholder only if placeholder was created
    execute """
    UPDATE playback_sessions
    SET item_jellyfin_id = '__PLACEHOLDER_ID__'
    WHERE item_jellyfin_id IS NOT NULL AND
      NOT EXISTS (SELECT 1 FROM jellyfin_items WHERE jellyfin_id = playback_sessions.item_jellyfin_id) AND
      EXISTS (SELECT 1 FROM jellyfin_items WHERE jellyfin_id = '__PLACEHOLDER_ID__')
    """

    execute """
    UPDATE activities
    SET item_jellyfin_id = '__PLACEHOLDER_ID__'
    WHERE item_jellyfin_id IS NOT NULL AND
      NOT EXISTS (SELECT 1 FROM jellyfin_items WHERE jellyfin_id = activities.item_jellyfin_id) AND
      EXISTS (SELECT 1 FROM jellyfin_items WHERE jellyfin_id = '__PLACEHOLDER_ID__')
    """

    # Add foreign key constraints to the playback sessions table
    alter table(:playback_sessions) do
      modify :item_jellyfin_id, references(:jellyfin_items, column: :jellyfin_id, type: :string, on_delete: :nilify_all)
    end

    # Add foreign key constraints to the activities table
    alter table(:activities) do
      modify :item_jellyfin_id, references(:jellyfin_items, column: :jellyfin_id, type: :string, on_delete: :nilify_all)
    end
  end

  def down do
    # Remove foreign key constraints from playback sessions
    drop_if_exists constraint(:playback_sessions, :playback_sessions_item_jellyfin_id_fkey)

    # Remove foreign key constraints from activities
    drop_if_exists constraint(:activities, :activities_item_jellyfin_id_fkey)

    # Restore the columns to be simple strings without constraints
    alter table(:playback_sessions) do
      modify :item_jellyfin_id, :string
    end

    alter table(:activities) do
      modify :item_jellyfin_id, :string
    end

    # Remove the placeholder item
    execute "DELETE FROM jellyfin_items WHERE jellyfin_id = '__PLACEHOLDER_ID__'"
  end
end
