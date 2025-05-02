# lib/streamystat_server/jellyfin/models/item.ex
defmodule StreamystatServer.Jellyfin.Models.Item do
  use Ecto.Schema
  import Ecto.Changeset
  alias StreamystatServer.Jellyfin.Models.Library
  alias StreamystatServer.Jellyfin.Servers.Models.Server

  @derive {Jason.Encoder,
           only: [
             :id,
             :jellyfin_id,
             :name,
             :type,
             :original_title,
             :etag,
             :date_created,
             :container,
             :sort_name,
             :premiere_date,
             :external_urls,
             :path,
             :official_rating,
             :overview,
             :genres,
             :community_rating,
             :runtime_ticks,
             :production_year,
             :is_folder,
             :parent_id,
             :media_type,
             :width,
             :height,
             :series_name,
             :series_id,
             :season_id,
             :season_name,
             :index_number,
             :parent_index_number,
             :primary_image_tag,
             :backdrop_image_tags,
             :image_blur_hashes,
             :video_type,
             :has_subtitles,
             :channel_id,
             :parent_backdrop_item_id,
             :parent_backdrop_image_tags,
             :parent_thumb_item_id,
             :parent_thumb_image_tag,
             :location_type,
             :primary_image_aspect_ratio,
             :series_primary_image_tag,
             :primary_image_thumb_tag,
             :primary_image_logo_tag,
             :library_id,
             :server_id,
             :people,
             :embedding,
             :inserted_at,
             :updated_at
           ]}

  schema "jellyfin_items" do
    field(:jellyfin_id, :string)
    field(:name, :string)
    field(:type, :string)
    field(:original_title, :string)
    field(:etag, :string)
    field(:date_created, :utc_datetime)
    field(:container, :string)
    field(:sort_name, :string)
    field(:premiere_date, :utc_datetime)
    field(:external_urls, {:array, :map})
    field(:path, :string)
    field(:official_rating, :string)
    field(:overview, :string)
    field(:genres, {:array, :string})
    field(:community_rating, :float)
    field(:runtime_ticks, :integer)
    field(:production_year, :integer)
    field(:is_folder, :boolean)
    field(:parent_id, :string)
    field(:media_type, :string)
    field(:width, :integer)
    field(:height, :integer)
    field(:series_name, :string)
    field(:series_id, :string)
    field(:season_id, :string)
    field(:season_name, :string)
    field(:index_number, :integer)
    field(:parent_index_number, :integer)
    field(:primary_image_tag, :string)
    field(:backdrop_image_tags, {:array, :string})
    field(:image_blur_hashes, :map)
    field(:video_type, :string)
    field(:has_subtitles, :boolean)
    field(:channel_id, :string)
    field(:parent_backdrop_item_id, :string)
    field(:parent_backdrop_image_tags, {:array, :string})
    field(:parent_thumb_item_id, :string)
    field(:parent_thumb_image_tag, :string)
    field(:location_type, :string)
    field(:primary_image_aspect_ratio, :float)
    field(:series_primary_image_tag, :string)
    field(:primary_image_thumb_tag, :string)
    field(:primary_image_logo_tag, :string)
    field(:people, {:array, :map})
    field(:embedding, Pgvector.Ecto.Vector)
    belongs_to(:library, Library)
    belongs_to(:server, Server)

    timestamps()
  end

  def changeset(item, attrs) do
    attrs =
      Map.update(attrs, :name, "Untitled Item", fn
        nil -> "Untitled Item"
        "" -> "Untitled Item"
        existing -> existing
      end)

    item
    |> cast(attrs, [
      :jellyfin_id,
      :name,
      :type,
      :library_id,
      :server_id,
      :original_title,
      :etag,
      :date_created,
      :container,
      :sort_name,
      :premiere_date,
      :external_urls,
      :path,
      :official_rating,
      :overview,
      :genres,
      :community_rating,
      :runtime_ticks,
      :production_year,
      :is_folder,
      :parent_id,
      :media_type,
      :width,
      :height,
      :series_name,
      :series_id,
      :season_id,
      :season_name,
      :index_number,
      :parent_index_number,
      :primary_image_tag,
      :backdrop_image_tags,
      :image_blur_hashes,
      :video_type,
      :has_subtitles,
      :channel_id,
      :parent_backdrop_item_id,
      :parent_backdrop_image_tags,
      :parent_thumb_item_id,
      :parent_thumb_image_tag,
      :location_type,
      :primary_image_aspect_ratio,
      :series_primary_image_tag,
      :people,
      :primary_image_thumb_tag,
      :primary_image_logo_tag,
      :embedding
    ])
    |> validate_required([:jellyfin_id, :name, :type, :library_id, :server_id])
    |> unique_constraint([:jellyfin_id, :library_id])
    |> foreign_key_constraint(:library_id)
    |> foreign_key_constraint(:server_id)
  end
end
