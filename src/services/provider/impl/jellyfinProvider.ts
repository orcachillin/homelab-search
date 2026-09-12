import { hostname } from "node:os";
import { Jellyfin } from "@jellyfin/sdk/lib/jellyfin.js";
import type { Api } from "@jellyfin/sdk/lib/api.js";
import { BaseItemKind } from "@jellyfin/sdk/lib/generated-client/models/base-item-kind.js";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models/base-item-dto.js";
import { ItemFields } from "@jellyfin/sdk/lib/generated-client/models/item-fields.js";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api.js";
import { getUserApi } from "@jellyfin/sdk/lib/utils/api/user-api.js";
import AbstractProvider, { MediaSource, MediaType, SearchResultType, type ProviderDownload, type ProviderThumbnail } from "../abstractProvider.js";
import { Color, SearchResultActionResolutionType, type SearchParams, type SearchResult, type SearchResults } from "../searchManager.js";
import type { JellyfinInstanceConfig } from "../../../config/providerConfig.js";

export default class JellyfinProvider extends AbstractProvider<`jellyfin.${string}`> {
    public readonly displayName: string

    private readonly client = new Jellyfin({
        clientInfo: { name: "homelab-search", version: "1.0.0" },
        deviceInfo: { id: hostname(), name: `${hostname()} node${process.version}` },
    })
    private api?: Api
    private userId?: string

    constructor(private readonly config: JellyfinInstanceConfig) {
        super(
            `jellyfin.${config.id}`,
            Object.values(MediaType).filter((value): value is MediaType => typeof value === "number"),
            MediaSource.Local,
            Object.values(SearchResultType),
            config.icon
        )
        this.displayName = config.name
        this.registerHandler("open", async (resultId) => ({
            success: true,
            type: SearchResultActionResolutionType.OpenUrl,
            url: `${this.publicUrl()}/web/#/details?id=${encodeURIComponent(resultId)}`,
        }))
    }

    public async init(): Promise<void> {
        const baseUrl = this.config.url
        const apiKey = this.config.apiKey
        if (apiKey) {
            this.api = this.client.createApi(baseUrl, apiKey)
            await getItemsApi(this.api).getItems({ limit: 1 })
            return
        }

        const username = this.config.username
        const password = this.config.password
        if (!username || !password) throw new Error("JELLYFIN_API_KEY or JELLYFIN_USERNAME and JELLYFIN_PASSWORD are required")

        const response = await getUserApi(this.client.createApi(baseUrl)).authenticateUserByName({
            authenticateUserByName: { Username: username, Pw: password },
        })
        const accessToken = response.data.AccessToken
        const userId = response.data.User?.Id
        if (!accessToken || !userId) throw new Error("Jellyfin authentication returned no access token or user ID")

        this.api = this.client.createApi(baseUrl, accessToken)
        this.userId = userId
    }

    public async query(params: SearchParams): Promise<SearchResults> {
        if (!this.api) throw new Error("Jellyfin provider is not initialized")
        const started = performance.now()
        const includeItemTypes = this.itemTypes(params.mediaTypes, params.resultTypes)
        const response = await getItemsApi(this.api).getItems({
            userId: this.userId,
            searchTerm: params.query,
            startIndex: params.offset ?? 0,
            limit: params.limit ?? 20,
            recursive: true,
            includeItemTypes,
            enableImages: true,
        })

        const results = (response.data.Items ?? []).flatMap((item: BaseItemDto) => {
            if (!item.Id) return []
            const details = [item.Type, item.ProductionYear, item.SeriesName, item.Album, ...(item.Artists ?? [])]
                .filter((value) => value !== undefined && value !== null && value !== "")

            const actions = [{ id: "open", label: "Open in Jellyfin", color: Color.Secondary, icon: "box-arrow-up-right" }]
            if (downloadableItemTypes.has(item.Type ?? "")) actions.push({ id: "browser-download", label: "Download", color: Color.Secondary, icon: "download" })
            return [{
                id: item.Id,
                provider: this,
                title: item.Name ?? "Untitled",
                description: item.Overview || details.join(" - "),
                thumbnailUrl: item.ImageTags?.Primary ? thumbnailUrl(this.name, item.Id) : "",
                actions,
                meta: {
                    itemType: item.Type,
                    coverArt: item.ImageTags?.Primary ? item.Id : undefined,
                    details: compactDetails([
                        ["Year", item.ProductionYear],
                        ["Status", item.Status],
                        ["Rating", item.CommunityRating?.toFixed(1)],
                        ["Certification", item.OfficialRating],
                        ["Runtime", item.RunTimeTicks ? `${Math.round(item.RunTimeTicks / 600_000_000)} min` : undefined],
                        ["Series", item.SeriesName],
                        ["Album", item.Album],
                        ["Artists", item.Artists?.join(", ")],
                        ["Genres", item.Genres?.join(", ")],
                        ["Studios", item.Studios?.map((studio) => studio.Name).filter(Boolean).join(", ")],
                    ]),
                },
            }]
        })

        return { results, took: performance.now() - started }
    }

    public async getThumbnail(id: string): Promise<ProviderThumbnail> {
        if (!this.api) throw new Error("Jellyfin provider is not initialized")
        const response = await this.api.axiosInstance.get(`/Items/${encodeURIComponent(id)}/Images/Primary`, {
            baseURL: this.api.basePath,
            headers: { Authorization: this.api.authorizationHeader },
            params: { maxWidth: 400, quality: 90 },
            responseType: "arraybuffer",
        })
        const contentType = String(response.headers["content-type"] ?? "application/octet-stream").split(";")[0]
        if (!contentType.startsWith("image/")) throw new Error("Jellyfin returned a non-image thumbnail")
        return { data: new Uint8Array(response.data), contentType }
    }

    public async getDownload(id: string, range?: string): Promise<ProviderDownload> {
        if (!this.api) throw new Error("Jellyfin provider is not initialized")
        const response = await fetch(`${this.api.basePath}/Items/${encodeURIComponent(id)}/Download`, {
            headers: { Authorization: this.api.authorizationHeader, ...(range ? { Range: range } : {}) },
            signal: AbortSignal.timeout(30_000),
        })
        return { response }
    }

    public async findByProviderId(provider: "Tmdb" | "Tvdb", externalId: number, title: string): Promise<string | undefined> {
        if (!this.api) return undefined
        const response = await getItemsApi(this.api).getItems({
            userId: this.userId,
            searchTerm: title,
            recursive: true,
            limit: 20,
            includeItemTypes: provider === "Tmdb" ? [BaseItemKind.Movie] : [BaseItemKind.Series],
            fields: [ItemFields.ProviderIds],
        })
        return response.data.Items?.find((item: BaseItemDto) => item.ProviderIds?.[provider] === String(externalId))?.Id
    }

    public async enrichResult(result: SearchResult): Promise<void> {
        const meta = result.meta as { externalProvider?: unknown, externalId?: unknown, availableInJellyfin?: boolean, tidarrDownloaded?: boolean, tidarrType?: string, artist?: string, album?: string } | undefined
        let itemId: string | undefined
        if ((meta?.externalProvider === "Tmdb" || meta?.externalProvider === "Tvdb") && typeof meta.externalId === "number") {
            itemId = await this.findByProviderId(meta.externalProvider, meta.externalId, result.title)
        } else if (meta?.tidarrDownloaded && meta.tidarrType) {
            itemId = await this.findMusicItem(meta.tidarrType, result.title, meta.artist, meta.album)
        }
        if (!itemId) return
        if (meta) meta.availableInJellyfin = true
        result.actions.unshift({
            id: "open",
            label: `Watch in ${this.displayName}`,
            color: Color.Secondary,
            icon: "play-fill",
            provider: this.name,
            resultId: itemId,
        })
    }

    private async findMusicItem(type: string, title: string, artist?: string, album?: string): Promise<string | undefined> {
        if (!this.api) return undefined
        const kinds = type === "artist" ? [BaseItemKind.MusicArtist] : type === "album" ? [BaseItemKind.MusicAlbum] : [BaseItemKind.Audio]
        const response = await getItemsApi(this.api).getItems({ userId: this.userId, searchTerm: title, recursive: true, limit: 30, includeItemTypes: kinds })
        return response.data.Items?.find((item: BaseItemDto) =>
            equal(item.Name, title)
            && (!artist || item.Artists?.some((name) => equal(name, artist)) || equal(item.AlbumArtist, artist))
            && (!album || equal(item.Album, album)))?.Id
    }

    private itemTypes(mediaTypes: Set<MediaType>, resultTypes: Set<SearchResultType>) {
        const selected = mediaTypes.size === 0 ? new Set(this.supportedMediaTypes) : mediaTypes
        const selectedResults = resultTypes.size === 0 ? new Set(this.supportedResultTypes) : resultTypes
        const includeMedia = resultTypes.size === 0
        const types = new Set<BaseItemKind>()
        if (selected.has(MediaType.Music) && selectedResults.has(SearchResultType.Song)) types.add(BaseItemKind.Audio)
        if (selected.has(MediaType.Music) && selectedResults.has(SearchResultType.Album)) types.add(BaseItemKind.MusicAlbum)
        if (selected.has(MediaType.Music) && selectedResults.has(SearchResultType.Artist)) types.add(BaseItemKind.MusicArtist)
        if (selectedResults.has(SearchResultType.Person)) types.add(BaseItemKind.Person)
        if (includeMedia && selected.has(MediaType.TvShow)) types.add(BaseItemKind.Series)
        if (includeMedia && selected.has(MediaType.Anime)) [BaseItemKind.Series, BaseItemKind.Movie].forEach((type) => types.add(type))
        if (includeMedia && selected.has(MediaType.Movie)) types.add(BaseItemKind.Movie)
        if (includeMedia && selected.has(MediaType.Video)) [BaseItemKind.Video, BaseItemKind.MusicVideo].forEach((type) => types.add(type))
        if (includeMedia && selected.has(MediaType.Book)) types.add(BaseItemKind.Book)
        if (includeMedia && selected.has(MediaType.AudioBook)) types.add(BaseItemKind.AudioBook)
        return [...types]
    }

    private publicUrl(): string {
        return this.config.publicUrl
    }
}

function thumbnailUrl(provider: string, id: string): string {
    return `/api/thumbnail?${new URLSearchParams({ provider, id })}`
}

function equal(left: string | null | undefined, right: string | undefined): boolean {
    return left?.normalize().toLowerCase().trim() === right?.normalize().toLowerCase().trim()
}

function compactDetails(entries: [string, unknown][]) {
    return entries.flatMap(([label, value]) => value === undefined || value === null || value === "" ? [] : [{ label, value: String(value) }])
}

const downloadableItemTypes = new Set([BaseItemKind.Audio, BaseItemKind.AudioBook, BaseItemKind.Book, BaseItemKind.Episode, BaseItemKind.Movie, BaseItemKind.MusicVideo, BaseItemKind.Video])
