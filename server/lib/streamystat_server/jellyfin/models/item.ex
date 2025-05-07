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
             :slug,
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
             :removed_at,
             :inserted_at,
             :updated_at
           ]}

  schema "jellyfin_items" do
    field(:jellyfin_id, :string)
    field(:name, :string)
    field(:slug, :string)
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
    field(:removed_at, :utc_datetime)
    belongs_to(:library, Library)
    belongs_to(:server, Server)

    timestamps()
  end

  defp slugify(name) do
    name
    |> String.downcase()
    |> String.trim()
    |> String.replace(~r/[^a-zA-Z0-9]+/, "-")
    |> String.replace(~r/^-+|-+$/, "")
  end

  defp generate_unique_slug(base_slug, server_id, id \\ nil) do
    import Ecto.Query
    alias StreamystatServer.Jellyfin.Models.Item
    query = from i in Item,
      where: i.server_id == ^server_id and not is_nil(i.slug) and (is_nil(^id) or i.id != ^id) and like(i.slug, ^"#{base_slug}%"),
      select: i.slug
    existing_slugs = StreamystatServer.Repo.all(query)
    if base_slug not in existing_slugs do
      base_slug
    else
      # Find the next available suffix
      suffix =
        existing_slugs
        |> Enum.map(fn
          ^base_slug -> 1
          slug ->
            case Regex.run(~r/^#{Regex.escape(base_slug)}--(\d+)$/, slug) do
              [_, n] -> String.to_integer(n)
              _ -> 1
            end
        end)
        |> Enum.max(fn -> 1 end)
        |> Kernel.+(1)
      "#{base_slug}--#{suffix}"
    end
  end

  def changeset(item, attrs) do
    attrs =
      Map.update(attrs, :name, "Untitled Item", fn
        nil -> "Untitled Item"
        "" -> "Untitled Item"
        existing -> existing
      end)

    type = attrs[:type] || attrs["type"]
    name = attrs[:name] || attrs["name"]
    server_id = attrs[:server_id] || attrs["server_id"]
    id = item.id

    slug =
      case type do
        "Movie" -> generate_unique_slug(slugify(name), server_id, id)
        "Series" -> generate_unique_slug(slugify(name), server_id, id)
        _ -> nil
      end

    item
    |> cast(attrs, [
      :jellyfin_id,
      :name,
      :slug,
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
      :primary_image_thumb_tag,
      :primary_image_logo_tag,
      :removed_at
    ])
    |> put_change(:slug, slug)
    |> validate_required([:jellyfin_id, :name, :type, :library_id, :server_id])
    |> unique_constraint([:server_id, :slug])
    |> unique_constraint([:jellyfin_id, :library_id])
    |> foreign_key_constraint(:library_id)
    |> foreign_key_constraint(:server_id)
  end
end
