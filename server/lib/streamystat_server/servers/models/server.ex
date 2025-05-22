defmodule StreamystatServer.Servers.Models.Server do
  use Ecto.Schema
  import Ecto.Changeset

  @type t :: %__MODULE__{
          id: integer() | nil,
          name: String.t(),
          url: String.t(),
          internal_url: String.t() | nil,
          external_url: String.t() | nil,
          api_key: String.t(),
          last_synced_playback_id: integer(),
          local_address: String.t() | nil,
          server_name: String.t() | nil,
          version: String.t() | nil,
          product_name: String.t() | nil,
          operating_system: String.t() | nil,
          jellyfin_id: String.t() | nil,
          startup_wizard_completed: boolean() | nil,
          open_ai_api_token: String.t() | nil,
          auto_generate_embeddings: boolean() | nil,
          inserted_at: NaiveDateTime.t() | nil,
          updated_at: NaiveDateTime.t() | nil
        }

  schema "servers" do
    field(:url, :string)
    field(:internal_url, :string)
    field(:external_url, :string)
    field(:local_address, :string)
    field(:server_name, :string)
    field(:version, :string)
    field(:product_name, :string)
    field(:operating_system, :string)
    field(:jellyfin_id, :string)
    field(:startup_wizard_completed, :boolean, default: false)
    field(:name, :string)
    field(:api_key, :string)
    field(:open_ai_api_token, :string)
    field(:auto_generate_embeddings, :boolean, default: false)
    field(:last_synced_playback_id, :integer, default: 0)
    timestamps()
  end

  def changeset(server, attrs) do
    server
    |> cast(attrs, [
      :url,
      :internal_url,
      :external_url,
      :local_address,
      :server_name,
      :version,
      :product_name,
      :operating_system,
      :jellyfin_id,
      :startup_wizard_completed,
      :name,
      :api_key,
      :open_ai_api_token,
      :auto_generate_embeddings,
      :last_synced_playback_id
    ])
    |> validate_required([:url, :api_key])
    |> validate_internal_external_urls()
    |> unique_constraint(:url)
  end

    # Custom validation to ensure at least one of internal_url or external_url is set
  defp validate_internal_external_urls(changeset) do
    internal_url = get_field(changeset, :internal_url)
    external_url = get_field(changeset, :external_url)

    # If both are blank, fall back to the legacy url field
    if is_nil(internal_url) && is_nil(external_url) do
      # This is OK - we'll use the legacy url field
      changeset
    else
      changeset
    end
  end

  @doc """
  Gets the internal URL for server-to-server communication.
  Falls back to the legacy URL field if internal_url is not set.
  """
  def get_internal_url(%__MODULE__{} = server) do
    server.internal_url || server.url
  end

  @doc """
  Gets the external URL for user-facing requests.
  Falls back to the legacy URL field if external_url is not set.
  """
  def get_external_url(%__MODULE__{} = server) do
    server.external_url || server.url
  end
end
