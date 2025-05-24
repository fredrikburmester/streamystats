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
          open_ai_api_token: String.t() | nil,
          auto_generate_embeddings: boolean() | nil,
          ollama_api_token: String.t() | nil,
          ollama_base_url: String.t() | nil,
          ollama_model: String.t() | nil,
          embedding_provider: String.t() | nil,
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
    field(:open_ai_api_token, :string)
    field(:auto_generate_embeddings, :boolean, default: false)
    field(:last_synced_playback_id, :integer, default: 0)
    field(:ollama_api_token, :string)
    field(:ollama_base_url, :string, default: "http://localhost:11434")
    field(:ollama_model, :string, default: "nomic-embed-text")
    field(:embedding_provider, :string, default: "openai")
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
      :open_ai_api_token,
      :auto_generate_embeddings,
      :last_synced_playback_id,
      :ollama_api_token,
      :ollama_base_url,
      :ollama_model,
      :embedding_provider
    ])
    |> validate_required([:url, :api_key])
    |> validate_inclusion(:embedding_provider, ["openai", "ollama"])
    |> unique_constraint(:url)
  end
end
