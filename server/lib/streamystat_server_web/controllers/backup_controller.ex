defmodule StreamystatServerWeb.BackupController do
  import Ecto.Query
  use StreamystatServerWeb, :controller
  alias StreamystatServer.Sessions.Models.PlaybackSession
  alias StreamystatServer.Servers.Models.Server
  alias StreamystatServer.Jellyfin.Models.User
  alias StreamystatServer.Repo
  require Logger

  # Set the amount of operations per batch
  @batch_size 1000
  # Default to 512KB cache size for low-resource systems
  @default_cache_size -512
  # Minimum memory threshold in MB to use memory storage
  @memory_storage_threshold 256

  defp configure_sqlite(db) do
    # Get system memory info using Erlang's built-in memory function
    total_memory = :erlang.memory(:total) / (1024 * 1024)  # Convert to MB
    # Configure cache size based on available memory
    cache_size = get_cache_size(total_memory)

    # Configure SQLite for better performance while being resource-friendly
    :ok = Exqlite.Sqlite3.execute(db, "PRAGMA journal_mode = DELETE")  # Use DELETE instead of WAL
    :ok = Exqlite.Sqlite3.execute(db, "PRAGMA synchronous = NORMAL") # Safer than OFF
    :ok = Exqlite.Sqlite3.execute(db, "PRAGMA cache_size = #{cache_size}")
    # Only use memory storage if we have enough RAM
    :ok = Exqlite.Sqlite3.execute(db, "PRAGMA temp_store = #{if total_memory > @memory_storage_threshold, do: "MEMORY", else: "FILE"}")
    # Set page size to 4KB (default) for better compatibility
    :ok = Exqlite.Sqlite3.execute(db, "PRAGMA page_size = 4096")
    # Set busy timeout to 5 seconds
    :ok = Exqlite.Sqlite3.execute(db, "PRAGMA busy_timeout = 5000")
  end

  defp get_cache_size(total_memory) do
    cond do
      total_memory > 1024 -> -2000
      total_memory > 512 -> -1024
      true -> @default_cache_size
    end
  end

  def export(conn, %{"server_id" => server_id_str}) do
    server_id = String.to_integer(server_id_str)
    # Create a temporary file for the SQLite database
    temp_path = Temp.path!(".db")
    db = nil
    stmt = nil

    try do
      {:ok, db} = Exqlite.Sqlite3.open(temp_path)
      :ok = configure_sqlite(db)
      :ok = create_playback_sessions_table(db)
      {:ok, stmt} = prepare_insert_statement(db)

      # Start a transaction for better performance
      :ok = Exqlite.Sqlite3.execute(db, "BEGIN IMMEDIATE TRANSACTION")

      case export_sessions(db, stmt, server_id) do
        {:ok, _} ->
          # Verify data was written
          {:ok, verify_stmt} = Exqlite.Sqlite3.prepare(db, "SELECT COUNT(*) FROM playback_sessions")
          {:row, [written_count]} = Exqlite.Sqlite3.step(db, verify_stmt)
          :ok = Exqlite.Sqlite3.release(db, verify_stmt)

          Logger.info("Successfully wrote #{written_count} sessions to SQLite database")

          :ok = Exqlite.Sqlite3.execute(db, "COMMIT")

          # Close the database properly
          :ok = Exqlite.Sqlite3.close(db)
          db = nil

          server = Repo.get(Server, server_id)
          filename = "playback_sessions_#{server.name}_#{Date.utc_today()}.db"

          # Verify file exists and has content
          case File.stat(temp_path) do
            {:ok, %{size: size}} ->
              Logger.info("Database file size: #{size} bytes")
            {:error, reason} ->
              Logger.error("Failed to stat database file: #{inspect(reason)}")
              raise "Database file not found or inaccessible"
          end

          conn =
            conn
            |> put_resp_content_type("application/x-sqlite3")
            |> put_resp_header("content-disposition", "attachment; filename=#{filename}")
            |> send_file(200, temp_path)

          # Schedule file deletion after response is sent
          Task.start(fn ->
            Process.sleep(10_000)
            File.rm(temp_path)
          end)

          conn
        {:error, reason} ->
          Logger.error("Export failed: #{inspect(reason)}")
          :ok = Exqlite.Sqlite3.execute(db, "ROLLBACK")
          conn |> put_status(:internal_server_error) |> json(%{error: "Failed to export playback sessions"})
      end
    rescue
      e ->
        Logger.error("Export failed: #{inspect(e)}")
        # Rollback transaction if it exists
        if db do
          :ok = Exqlite.Sqlite3.execute(db, "ROLLBACK")
        end
        conn |> put_status(:internal_server_error) |> json(%{error: "Failed to export playback sessions"})
    after
      cleanup_resources(db, stmt, temp_path)
    end
  end

  defp create_playback_sessions_table(db) do
    case Exqlite.Sqlite3.execute(db, """
    CREATE TABLE playback_sessions (
      id INTEGER PRIMARY KEY,
      user_jellyfin_id TEXT,
      device_id TEXT,
      device_name TEXT,
      client_name TEXT,
      item_jellyfin_id TEXT,
      item_name TEXT,
      series_jellyfin_id TEXT,
      series_name TEXT,
      season_jellyfin_id TEXT,
      play_duration INTEGER,
      play_method TEXT,
      start_time TEXT,
      end_time TEXT,
      position_ticks INTEGER,
      runtime_ticks INTEGER,
      percent_complete FLOAT,
      completed BOOLEAN,
      is_paused BOOLEAN,
      is_muted BOOLEAN,
      volume_level INTEGER,
      audio_stream_index INTEGER,
      subtitle_stream_index INTEGER,
      media_source_id TEXT,
      repeat_mode TEXT,
      playback_order TEXT,
      remote_end_point TEXT,
      session_id TEXT,
      user_name TEXT,
      last_activity_date TEXT,
      last_playback_check_in TEXT,
      application_version TEXT,
      is_active BOOLEAN,
      transcoding_audio_codec TEXT,
      transcoding_video_codec TEXT,
      transcoding_container TEXT,
      transcoding_is_video_direct BOOLEAN,
      transcoding_is_audio_direct BOOLEAN,
      transcoding_bitrate INTEGER,
      transcoding_completion_percentage FLOAT,
      transcoding_width INTEGER,
      transcoding_height INTEGER,
      transcoding_audio_channels INTEGER,
      transcoding_hardware_acceleration_type TEXT,
      transcoding_reasons TEXT,
      inserted_at TEXT,
      updated_at TEXT
    )
    """) do
      {:ok, _} -> :ok
      :ok -> :ok
      error -> error
    end
  end

  defp prepare_insert_statement(db) do
    Exqlite.Sqlite3.prepare(db, """
    INSERT INTO playback_sessions (
      id, user_jellyfin_id, device_id, device_name, client_name,
      item_jellyfin_id, item_name, series_jellyfin_id, series_name,
      season_jellyfin_id, play_duration, play_method, start_time,
      end_time, position_ticks, runtime_ticks, percent_complete,
      completed, is_paused, is_muted, volume_level, audio_stream_index,
      subtitle_stream_index, media_source_id, repeat_mode, playback_order,
      remote_end_point, session_id, user_name, last_activity_date,
      last_playback_check_in, application_version, is_active,
      transcoding_audio_codec, transcoding_video_codec, transcoding_container,
      transcoding_is_video_direct, transcoding_is_audio_direct, transcoding_bitrate,
      transcoding_completion_percentage, transcoding_width, transcoding_height,
      transcoding_audio_channels, transcoding_hardware_acceleration_type,
      transcoding_reasons, inserted_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """)
  end

  defp export_sessions(db, stmt, server_id) do
    Repo.transaction(fn ->
      from(s in PlaybackSession, where: s.server_id == ^server_id)
      |> Repo.stream()
      |> Stream.each(fn s ->
        bind_session_to_statement(stmt, s)
        case Exqlite.Sqlite3.step(db, stmt) do
          :done -> :ok
          {:error, reason} ->
            Logger.error("Failed to write session #{s.id}: #{inspect(reason)}")
            raise "Failed to write session to SQLite"
        end
        :ok = Exqlite.Sqlite3.reset(stmt)
      end)
      |> Stream.run()
    end, timeout: 300_000)
  end

  defp bind_session_to_statement(stmt, session) do
    values = [
      session.id,
      session.user_jellyfin_id,
      session.device_id,
      session.device_name,
      session.client_name,
      session.item_jellyfin_id,
      session.item_name,
      session.series_jellyfin_id,
      session.series_name,
      session.season_jellyfin_id,
      session.play_duration,
      session.play_method,
      if(session.start_time, do: DateTime.to_iso8601(session.start_time), else: nil),
      if(session.end_time, do: DateTime.to_iso8601(session.end_time), else: nil),
      session.position_ticks,
      session.runtime_ticks,
      session.percent_complete,
      session.completed,
      session.is_paused,
      session.is_muted,
      session.volume_level,
      session.audio_stream_index,
      session.subtitle_stream_index,
      session.media_source_id,
      session.repeat_mode,
      session.playback_order,
      session.remote_end_point,
      session.session_id,
      session.user_name,
      if(session.last_activity_date, do: DateTime.to_iso8601(session.last_activity_date), else: nil),
      if(session.last_playback_check_in, do: DateTime.to_iso8601(session.last_playback_check_in), else: nil),
      session.application_version,
      session.is_active,
      session.transcoding_audio_codec,
      session.transcoding_video_codec,
      session.transcoding_container,
      session.transcoding_is_video_direct,
      session.transcoding_is_audio_direct,
      session.transcoding_bitrate,
      session.transcoding_completion_percentage,
      session.transcoding_width,
      session.transcoding_height,
      session.transcoding_audio_channels,
      session.transcoding_hardware_acceleration_type,
      Enum.join(session.transcoding_reasons || [], ","),
      NaiveDateTime.to_iso8601(session.inserted_at),
      NaiveDateTime.to_iso8601(session.updated_at)
    ]

    case Exqlite.Sqlite3.bind(stmt, values) do
      :ok -> :ok
      {:error, reason} ->
        Logger.error("Failed to bind session #{session.id}: #{inspect(reason)}")
        raise "Failed to bind session to SQLite statement"
    end
  end

  def import(conn, %{"server_id" => server_id_str, "file" => %Plug.Upload{path: path} = upload}) do
    server_id = String.to_integer(server_id_str)
    Logger.info("Starting import from file: #{upload.filename}, size: #{File.stat!(path).size} bytes")

    case Repo.get(Server, server_id) do
      nil ->
        Logger.error("Import failed: Server with ID #{server_id} not found")
        conn |> put_status(:not_found) |> json(%{error: "Server not found"})

      server ->
        Logger.info("Importing playback sessions for server: #{server.name} (ID: #{server_id})")
        case process_import(path, server_id) do
          {:ok, count} ->
            Logger.info("Import successful: #{count} playback sessions imported")
            json(conn, %{message: "Successfully imported #{count} playback sessions"})

          {:partial, imported, skipped, reason} ->
            # Partial success - some records imported, some failed
            message = "Partially imported #{imported} playback sessions (#{skipped} skipped): #{reason}"
            Logger.warn(message)
            conn |> put_status(:partial_content) |> json(%{
              message: message,
              imported: imported,
              skipped: skipped
            })

          {:error, reason} ->
            Logger.error("Import failed with error: #{inspect(reason)}")
            conn |> put_status(:bad_request) |> json(%{error: reason})
        end
    end
  end

  defp process_import(file_path, server_id) do
    Logger.debug("Starting import process for file: #{file_path}")

    with {:ok, file_stat} <- File.stat(file_path),
         :ok <- verify_file_size(file_stat),
         :ok <- verify_file_exists(file_path),
         {:ok, db} <- open_sqlite_db(file_path),
         {:ok, table_name} <- find_playback_sessions_table(db) do

      # Prepare the statement using the table name
      prepare_result = prepare_statement(db, table_name)

      case prepare_result do
        {:ok, stmt} ->
          process_with_statement(db, stmt, server_id)

        {:error, reason} ->
          Logger.error("Failed to prepare statement: #{inspect(reason)}")
          {:error, "Failed to prepare SQL statement: #{inspect(reason)}"}
      end
    else
      {:error, reason} ->
        Logger.error("Import process error: #{inspect(reason)}")
        {:error, reason}
      :ok ->
        Logger.error("Unexpected :ok response during import")
        {:error, "Unexpected response during import process"}
      other ->
        Logger.error("Unexpected error during import: #{inspect(other)}")
        error_msg = try do
          "Import failed: #{Exception.message(other)}"
        rescue
          # Handle case where other isn't an exception
          _ -> "Import failed: unexpected error (#{inspect(other)})"
        end
        {:error, error_msg}
    end
  end

  defp process_with_statement(db, stmt, server_id) do
    # First try to get columns through standard method
    columns_result = get_columns(db, stmt)

    case columns_result do
      {:ok, cols} ->
        Logger.debug("Got columns for prepared statement: #{inspect(cols)}")
        # Get the rows and proceed with import
        with rows when is_list(rows) <- fetch_all_rows(db, stmt),
             :ok <- cleanup_db_resources(db, stmt) do

          Logger.debug("Successfully read #{length(rows)} rows from import file")
          process_import_batches(rows, cols, server_id)
        else
          error ->
            Logger.error("Failed to fetch rows: #{inspect(error)}")
            cleanup_db_resources(db, stmt)
            {:error, "Failed to read rows from database"}
        end

      {:error, reason} ->
        Logger.error("Failed to get columns: #{inspect(reason)}")
        cleanup_db_resources(db, stmt)
        {:error, "Failed to get column information: #{inspect(reason)}"}

      unexpected ->
        Logger.error("Unexpected result getting columns: #{inspect(unexpected)}")
        cleanup_db_resources(db, stmt)
        {:error, "Unexpected error getting column information"}
    end
  end

  defp verify_file_size(%{size: size}) do
    case size do
      0 -> {:error, "Import file is empty"}
      _ -> :ok
    end
  end

  defp open_sqlite_db(file_path) do
    try do
      Logger.debug("Opening SQLite database: #{file_path}")

      # Check if the file appears to be a valid SQLite file
      validate_sqlite_file(file_path)

      case Exqlite.Sqlite3.open(file_path, mode: :readonly) do
        {:ok, db} ->
          # Try to read SQLite version to verify connection
          case Exqlite.Sqlite3.execute(db, "SELECT sqlite_version()") do
            {:ok, [[version]]} ->
              Logger.debug("Connected to SQLite database, version: #{version}")
              {:ok, db}
            _ ->
              Logger.debug("Connected to SQLite database, but couldn't verify version")
              {:ok, db}
          end
        other -> other
      end
    rescue
      e ->
        Logger.error("Failed to open SQLite database: #{Exception.message(e)}")
        {:error, "Failed to open database file, it may be corrupted or not a valid SQLite file"}
    end
  end

  defp validate_sqlite_file(file_path) do
    # Check the file signature (SQLite files start with "SQLite format 3\000")
    case File.open(file_path, [:read]) do
      {:ok, file} ->
        case :file.read(file, 16) do
          {:ok, "SQLite format 3" <> _} ->
            Logger.debug("File has valid SQLite header signature")
            File.close(file)
            :ok
          {:ok, other} ->
            Logger.error("Invalid SQLite file signature: #{inspect(other)}")
            File.close(file)
            :ok  # Still return ok to continue with more detailed diagnostics
          error ->
            Logger.error("Error reading SQLite file header: #{inspect(error)}")
            File.close(file)
            :ok  # Still return ok to continue with normal import flow
        end
      error ->
        Logger.error("Could not open file for header check: #{inspect(error)}")
        :ok  # Still return ok to allow normal import flow to handle errors
    end
  end

  defp prepare_statement(db, table_name) do
    Logger.debug("Preparing statement for table: #{table_name}")
    query = "SELECT * FROM #{table_name}"
    Exqlite.Sqlite3.prepare(db, query)
  end

  defp get_columns(db, stmt) do
    Logger.debug("Getting columns for prepared statement")
    Exqlite.Sqlite3.columns(db, stmt)
  end

  defp verify_file_exists(file_path) do
    if File.exists?(file_path), do: :ok, else: {:error, "Database file not found: #{file_path}"}
  end

  defp find_playback_sessions_table(db) do
    Logger.debug("Looking for playback_sessions table in the database file")

    # Try multiple approaches to find tables
    try_direct_table_access(db)
  end

  defp try_direct_table_access(db) do
    # First try: Standard approach with sqlite_master
    master_query_result = Exqlite.Sqlite3.execute(db, "SELECT name FROM sqlite_master WHERE type='table'")
    Logger.debug("sqlite_master query result: #{inspect(master_query_result)}")

    # Second try: Attempt to directly access the playback_sessions table
    Logger.debug("Attempting direct access to playback_sessions table")
    direct_result = Exqlite.Sqlite3.execute(db, "SELECT 1 FROM playback_sessions LIMIT 1")
    Logger.debug("Direct table access result: #{inspect(direct_result)}")

    # Based on the results, determine the best course of action
    cond do
      # If master query found tables, use that
      match?({:ok, tables} when is_list(tables) and length(tables) > 0, master_query_result) ->
        {:ok, tables} = master_query_result
        Logger.debug("Found tables in database via sqlite_master: #{inspect(tables)}")
        search_for_playback_table(db, tables)

      # If direct access to playback_sessions worked
      match?({:ok, _}, direct_result) or direct_result == :ok ->
        Logger.debug("Direct access to playback_sessions table succeeded")
        # Verify we can get column info
        case Exqlite.Sqlite3.execute(db, "PRAGMA table_info(playback_sessions)") do
          {:ok, columns} when is_list(columns) ->
            Logger.debug("Found playback_sessions table with columns via direct access")
            {:ok, "playback_sessions"}
          other ->
            Logger.debug("Direct access succeeded but couldn't get column info: #{inspect(other)}")
            {:ok, "playback_sessions"} # Still proceed since we know table exists
        end

      # Try to diagnose other database issues
      true ->
        diagnose_database_issues(db, master_query_result, direct_result)
    end
  end

  defp diagnose_database_issues(db, master_query_result, direct_result) do
    # Log detailed diagnostic information
    Logger.error("Could not find tables via standard methods")
    Logger.error("sqlite_master query result: #{inspect(master_query_result)}")
    Logger.error("Direct table access result: #{inspect(direct_result)}")

    # Try to get database information via PRAGMA statements
    pragma_results = %{
      integrity_check: Exqlite.Sqlite3.execute(db, "PRAGMA integrity_check"),
      foreign_keys: Exqlite.Sqlite3.execute(db, "PRAGMA foreign_keys"),
      journal_mode: Exqlite.Sqlite3.execute(db, "PRAGMA journal_mode"),
      synchronous: Exqlite.Sqlite3.execute(db, "PRAGMA synchronous")
    }

    Logger.debug("PRAGMA diagnostics: #{inspect(pragma_results)}")

    # If direct access failed with specific errors, provide those messages
    cond do
      match?({:error, reason}, direct_result) ->
        Logger.error("Direct access to playback_sessions table failed: #{inspect(direct_result)}")
        {:error, "Could not access playback_sessions table: #{inspect(direct_result)}"}

      match?({:error, reason}, master_query_result) ->
        Logger.error("SQLite master table query failed: #{inspect(master_query_result)}")
        {:error, "Database structure query failed: #{inspect(master_query_result)}"}

      true ->
        # Last resort, assume it's a different issue
        Logger.error("No tables found in the database file or unexpected database structure")
        {:error, "The database file appears valid but no tables could be found or accessed"}
    end
  end

  defp search_for_playback_table(db, tables) do
    case Exqlite.Sqlite3.execute(db, "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%playback_sessions%'") do
      {:ok, []} ->
        Logger.error("No playback_sessions table found in the database")
        {:error, "No playback sessions table found in database. Available tables: #{inspect(tables)}"}

      :ok ->
        # :ok means success but empty result
        Logger.error("No playback_sessions table found in the database")
        {:error, "No playback sessions table found in database. Available tables: #{inspect(tables)}"}

      {:ok, [[table_name]]} ->
        # Check if the table has the expected structure
        validate_table_structure(db, table_name, tables)

      {:error, reason} ->
        Logger.error("Error looking for playback_sessions table: #{inspect(reason)}")
        {:error, "Error searching for playback sessions table: #{inspect(reason)}"}

      unexpected ->
        Logger.error("Unexpected result when looking for playback_sessions table: #{inspect(unexpected)}")
        {:error, "Unexpected result when searching for playback sessions table"}
    end
  end

  defp validate_table_structure(db, table_name, all_tables) do
    # Check if the table has the minimum required columns
    case Exqlite.Sqlite3.execute(db, "PRAGMA table_info(#{table_name})") do
      {:ok, columns} when is_list(columns) ->
        column_names = Enum.map(columns, fn column -> Enum.at(column, 1) end)
        Logger.debug("Found columns in table #{table_name}: #{inspect(column_names)}")

        required_columns = ["id", "user_jellyfin_id", "item_jellyfin_id", "play_duration"]
        missing_columns = Enum.filter(required_columns, fn col -> col not in column_names end)

        if Enum.empty?(missing_columns) do
          Logger.debug("Table #{table_name} has all required columns")
          {:ok, table_name}
        else
          Logger.error("Table #{table_name} is missing required columns: #{inspect(missing_columns)}")
          {:error, "The playback_sessions table is missing required columns: #{inspect(missing_columns)}"}
        end

      :ok ->
        Logger.error("Failed to get column info for table #{table_name}")
        {:error, "Failed to get column information for playback_sessions table"}

      {:error, reason} ->
        Logger.error("Error getting column info for table #{table_name}: #{inspect(reason)}")
        {:error, "Failed to validate table structure: #{inspect(reason)}"}

      unexpected ->
        Logger.error("Unexpected result when getting column info: #{inspect(unexpected)}")
        {:error, "Failed to validate table structure due to unexpected error"}
    end
  end

  defp fetch_all_rows(db, stmt) do
    Logger.debug("Starting to fetch rows from database")
    try do
      rows = []
      result = fetch_all_rows(db, stmt, rows, 0)
      Logger.debug("Finished fetching rows: #{inspect(result)}")
      result
    rescue
      e ->
        error_message = "Error starting row fetch: #{Exception.message(e)}"
        Logger.error(error_message)
        {:error, error_message}
    end
  end

  defp fetch_all_rows(db, stmt, rows, count) do
    try do
      case Exqlite.Sqlite3.step(db, stmt) do
        {:row, row} ->
          # Log progress for large imports
          new_count = count + 1
          if rem(new_count, 1000) == 0 do
            Logger.debug("Fetched #{new_count} rows so far")
          end
          fetch_all_rows(db, stmt, [row | rows], new_count)
        :done ->
          Logger.debug("Done fetching all rows. Total: #{count}")
          Enum.reverse(rows)
        {:error, reason} ->
          Logger.error("Error fetching rows at row #{count}: #{inspect(reason)}")
          {:error, reason}
        unexpected ->
          Logger.error("Unexpected response from database at row #{count}: #{inspect(unexpected)}")
          {:error, "Unexpected response from database: #{inspect(unexpected)}"}
      end
    rescue
      e ->
        error_message = "Error during row fetch at row #{count}: #{Exception.message(e)}"
        Logger.error(error_message)
        {:error, error_message}
    end
  end

  defp cleanup_db_resources(db, stmt) do
    # Release the statement
    release_result = try do
      Exqlite.Sqlite3.release(db, stmt)
    rescue
      _ -> :error
    end

    # Close the database
    close_result = try do
      Exqlite.Sqlite3.close(db)
    rescue
      _ -> :error
    end

    # Log any errors but always return :ok to not disrupt the flow
    case {release_result, close_result} do
      {:ok, :ok} -> :ok
      {release_result, close_result} ->
        Logger.error("Error during cleanup: release=#{inspect(release_result)}, close=#{inspect(close_result)}")
        :ok
    end
  end

  defp process_import_batches(rows, cols, server_id) do
    # Convert column names to atoms for easier access
    col_atoms = Enum.map(cols, &String.to_atom/1)

    # Track statistics
    stats = %{imported: 0, skipped: 0, errors: 0}

    # Process rows in batches
    result = rows
    |> Enum.chunk_every(@batch_size)
    |> Enum.reduce_while({:ok, stats}, fn batch, {:ok, stats} ->
      case process_batch(batch, col_atoms, server_id) do
        {:ok, batch_stats} ->
          new_stats = %{
            imported: stats.imported + batch_stats.imported,
            skipped: stats.skipped + batch_stats.skipped,
            errors: stats.errors + batch_stats.errors
          }
          {:cont, {:ok, new_stats}}

        {:error, reason} ->
          {:halt, {:error, reason, stats}}
      end
    end)

    case result do
      {:ok, stats} ->
        total = stats.imported + stats.skipped
        skipped_percent = if total > 0, do: Float.round(stats.skipped / total * 100, 1), else: 0

        if stats.skipped > 0 do
          Logger.info("Import completed with #{stats.imported} records imported, #{stats.skipped} skipped (#{skipped_percent}%)")

          if stats.imported > 0 do
            {:partial, stats.imported, stats.skipped, "Some records already existed"}
          else
            {:error, "All records already exist in the database (#{stats.skipped} duplicates)"}
          end
        else
          {:ok, stats.imported}
        end

      {:error, reason, stats} ->
        if stats.imported > 0 do
          {:partial, stats.imported, stats.skipped, reason}
        else
          {:error, reason}
        end
    end
  end

  defp process_batch(rows, col_atoms, server_id) do
    # Convert rows to maps with atom keys
    sessions = Enum.map(rows, fn row ->
      Enum.zip(col_atoms, row) |> Map.new()
    end)

    # Track import statistics for this batch
    batch_stats = %{imported: 0, skipped: 0, errors: 0}

    # Insert sessions in a transaction with conflict handling
    case Repo.transaction(fn ->
      Enum.reduce_while(sessions, {:ok, batch_stats}, fn session, {:ok, stats} ->
        case import_session(session, server_id) do
          {:ok, _} ->
            {:cont, {:ok, %{stats | imported: stats.imported + 1}}}

          {:skipped, :duplicate} ->
            {:cont, {:ok, %{stats | skipped: stats.skipped + 1}}}

          {:error, %Ecto.Changeset{errors: errors}} = error ->
            if is_duplicate_error?(errors) do
              # Skip duplicates and continue
              Logger.debug("Skipping duplicate record with ID: #{session.id}")
              {:cont, {:ok, %{stats | skipped: stats.skipped + 1}}}
            else
              # For other errors, halt the process
              Logger.error("Error importing session: #{inspect(error)}")
              {:halt, {:error, "Failed to import record: #{inspect(errors)}", stats}}
            end

          {:error, reason} ->
            Logger.error("Error importing session: #{inspect(reason)}")
            stats = %{stats | errors: stats.errors + 1}
            {:halt, {:error, reason, stats}}
        end
      end)
    end) do
      {:ok, {:ok, stats}} -> {:ok, stats}
      {:ok, {:error, reason, stats}} -> {:error, reason, stats}
      {:error, reason} -> {:error, reason}
    end
  end

  defp import_session(session, server_id) do
    # Try to get existing session with same ID
    case Repo.get(PlaybackSession, session.id) do
      %PlaybackSession{} = existing ->
        Logger.debug("Found existing session with ID #{session.id}, skipping")
        {:skipped, :duplicate}

      nil ->
        # Look up user by jellyfin_id
        user_id =
          if session.user_jellyfin_id do
            case Repo.one(from u in User, where: u.jellyfin_id == ^session.user_jellyfin_id and u.server_id == ^server_id, select: u.id) do
              nil ->
                Logger.debug("User with jellyfin_id #{session.user_jellyfin_id} not found for server_id #{server_id}")
                nil
              id -> id
            end
          else
            nil
          end

        # Convert string timestamps to DateTime
        start_time = parse_datetime(session.start_time)
        end_time = parse_datetime(session.end_time)
        last_activity_date = parse_datetime(session.last_activity_date)
        last_playback_check_in = parse_datetime(session.last_playback_check_in)
        inserted_at = parse_datetime(session.inserted_at)
        updated_at = parse_datetime(session.updated_at)

        # Convert transcoding_reasons string to list if it exists
        transcoding_reasons =
          if is_binary(session.transcoding_reasons) && String.trim(session.transcoding_reasons) != "" do
            String.split(session.transcoding_reasons, ",")
          else
            nil
          end

        # Create session with converted timestamps
        %PlaybackSession{}
        |> PlaybackSession.changeset(%{
          id: session.id,
          user_jellyfin_id: session.user_jellyfin_id,
          device_id: session.device_id,
          device_name: session.device_name,
          client_name: session.client_name,
          item_jellyfin_id: session.item_jellyfin_id,
          item_name: session.item_name,
          series_jellyfin_id: session.series_jellyfin_id,
          series_name: session.series_name,
          season_jellyfin_id: session.season_jellyfin_id,
          play_duration: session.play_duration,
          play_method: session.play_method,
          start_time: start_time,
          end_time: end_time,
          position_ticks: session.position_ticks,
          runtime_ticks: session.runtime_ticks,
          percent_complete: session.percent_complete,
          completed: parse_bool(session.completed),
          is_paused: parse_bool(session.is_paused),
          is_muted: parse_bool(session.is_muted),
          volume_level: session.volume_level,
          audio_stream_index: session.audio_stream_index,
          subtitle_stream_index: session.subtitle_stream_index,
          media_source_id: session.media_source_id,
          repeat_mode: session.repeat_mode,
          playback_order: session.playback_order,
          remote_end_point: session.remote_end_point,
          session_id: session.session_id,
          user_name: session.user_name,
          last_activity_date: last_activity_date,
          last_playback_check_in: last_playback_check_in,
          application_version: session.application_version,
          is_active: parse_bool(session.is_active),
          transcoding_audio_codec: session.transcoding_audio_codec,
          transcoding_video_codec: session.transcoding_video_codec,
          transcoding_container: session.transcoding_container,
          transcoding_is_video_direct: parse_bool(session.transcoding_is_video_direct),
          transcoding_is_audio_direct: parse_bool(session.transcoding_is_audio_direct),
          transcoding_bitrate: session.transcoding_bitrate,
          transcoding_completion_percentage: session.transcoding_completion_percentage,
          transcoding_width: session.transcoding_width,
          transcoding_height: session.transcoding_height,
          transcoding_audio_channels: session.transcoding_audio_channels,
          transcoding_hardware_acceleration_type: session.transcoding_hardware_acceleration_type,
          transcoding_reasons: transcoding_reasons,
          user_id: user_id,
          server_id: server_id,
          inserted_at: inserted_at,
          updated_at: updated_at
        })
        |> Repo.insert()
    end
  end

  defp is_duplicate_error?(errors) do
    Enum.any?(errors, fn {field, {message, details}} ->
      message =~ "has already been taken" or
      (details[:constraint] == "unique" or details[:constraint] == "primary") or
      details[:constraint] == "playback_sessions_unique_index" or
      details[:constraint] =~ "unique"
    end)
  end

  defp parse_datetime(nil), do: nil
  defp parse_datetime(datetime_str) when is_binary(datetime_str) do
    case DateTime.from_iso8601(datetime_str) do
      {:ok, datetime, _} -> datetime
      _ -> nil
    end
  end
  defp parse_datetime(_), do: nil

  defp parse_bool(val) when val in [true, 1, "1", "t", "true", "TRUE"], do: true
  defp parse_bool(val) when val in [false, 0, "0", "f", "false", "FALSE"], do: false
  defp parse_bool(_), do: false

  defp cleanup_resources(db, stmt, temp_path) do
    if db do
      :ok = Exqlite.Sqlite3.close(db)
    end
    if stmt do
      :ok = Exqlite.Sqlite3.release(db, stmt)
    end
    if temp_path do
      File.rm(temp_path)
    end
  end
end
