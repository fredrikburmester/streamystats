defmodule StreamystatServer.Servers.Models.Server do
  use Ecto.Schema
  import Ecto.Changeset

  @type t :: %__MODULE__{
          id: integer() | nil,
          name: String.t(),
          url: String.t(),
          api_key: String.t(),
          last_synced_playback_id: integer(),
          local_address: String.t() | nil,
          server_name: String.t() | nil,
          version: String.t() | nil,
          product_name: String.t() | nil,
          operating_system: String.t() | nil,
          jellyfin_id: String.t() | nil,
          startup_wizard_completed: boolean() | nil,
          enabled_libraries: list(String.t()),
          inserted_at: NaiveDateTime.t() | nil,
          updated_at: NaiveDateTime.t() | nil
        }

  schema "servers" do
    field(:url, :string)
    field(:local_address, :string)
    field(:server_name, :string)
    field(:version, :string)
    field(:product_name, :string)
    field(:operating_system, :string)
    field(:jellyfin_id, :string)
    field(:startup_wizard_completed, :boolean, default: false)
    field(:name, :string)
    field(:api_key, :string)
    field(:last_synced_playback_id, :integer, default: 0)
    field(:enabled_libraries, {:array, :string}, default: [])
    timestamps()
  end

  def changeset(server, attrs) do
    server
    |> cast(attrs, [
      :url,
      :local_address,
      :server_name,
      :version,
      :product_name,
      :operating_system,
      :jellyfin_id,
      :startup_wizard_completed,
      :name,
      :api_key,
      :last_synced_playback_id,
      :enabled_libraries
    ])
    |> validate_required([:url, :api_key, :enabled_libraries])
    |> unique_constraint(:url)
  end
end
