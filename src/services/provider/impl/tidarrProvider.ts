import AbstractProvider, { MediaSource, MediaType, SearchResultType, type ProviderActivity, type ProviderThumbnail } from "../abstractProvider.js"
import { Color, SearchResultActionResolutionType, type SearchParams, type SearchResult, type SearchResults } from "../searchManager.js"
import type { TidarrInstanceConfig } from "../../../config/providerConfig.js"

interface TidalArtist {
    id: string | number
    name?: string
    picture?: string
    popularity?: number
}

interface TidalAlbum {
    id: string | number
    title?: string
    cover?: string
    artists?: TidalArtist[]
    artist?: TidalArtist
    releaseDate?: string
    audioQuality?: string
    audioModes?: string[]
    numberOfTracks?: number
    duration?: number
    explicit?: boolean
}

interface TidalTrack {
    id: string | number
    title?: string
    artists?: TidalArtist[]
    artist?: TidalArtist
    album?: TidalAlbum
    isrc?: string
    duration?: number
    audioQuality?: string
    audioModes?: string[]
    explicit?: boolean
}

interface TidalSearchResponse {
    artists?: { items?: TidalArtist[] }
    albums?: { items?: TidalAlbum[] }
    tracks?: { items?: TidalTrack[] }
}

interface TidarrQueueItem { id: string, artist?: string, title?: string, type?: string, status?: string, error?: boolean, progress?: { current?: number, total?: number } }
interface TidarrQueue { queue?: TidarrQueueItem[] }
interface TidarrQueueStatus { isPaused?: boolean }

export default class TidarrProvider extends AbstractProvider<`tidarr.${string}`> {
    public readonly displayName: string

    constructor(private readonly config: TidarrInstanceConfig) {
        super(`tidarr.${config.id}`, [MediaType.Music], MediaSource.Download, [SearchResultType.Artist, SearchResultType.Album, SearchResultType.Song], config.icon)
        this.displayName = config.name
        this.registerHandler("download", async (resultId) => {
            const [type, id] = this.parseResultId(resultId)
            const expandedIds = type === "artist" ? [...await this.artistAlbumTrackingIds(id), "album:*"] : []
            await this.request("/api/save", {}, {
                method: "POST",
                body: JSON.stringify({ item: {
                    id,
                    type: type === "song" ? "track" : type,
                    status: "queue_download",
                    url: `https://listen.tidal.com/${type === "song" ? "track" : type}/${encodeURIComponent(id)}`,
                } }),
            }, false)
            return {
                success: true,
                type: SearchResultActionResolutionType.Message,
                message: `Added to ${this.displayName}'s download queue.`,
                color: Color.Success,
                activityTrackingId: `${type === "song" ? "track" : type}:${id}`,
                activityTrackingIds: expandedIds,
            }
        })
        this.registerHandler("open", async (resultId) => {
            const [type, id] = this.parseResultId(resultId)
            return {
                success: true,
                type: SearchResultActionResolutionType.OpenUrl,
                url: `${this.config.publicUrl}/${type === "song" ? "track" : type}/${encodeURIComponent(id)}`,
            }
        })
    }

    public async init(): Promise<void> {
        await this.request("/api/is-auth-active")
    }

    public async query(params: SearchParams): Promise<SearchResults> {
        const started = performance.now()
        const selected = params.resultTypes.size === 0 ? new Set(this.supportedResultTypes) : params.resultTypes
        const [data, history] = await Promise.all([
            this.request<TidalSearchResponse>("/proxy/tidal/v2/search", {
                query: params.query,
                offset: params.offset ?? 0,
                limit: params.limit ?? 20,
                countryCode: this.config.countryCode,
                deviceType: "BROWSER",
                locale: "en_US",
            }),
            this.request<string[]>("/api/history/list").catch(() => []),
        ])
        const downloaded = new Set(history.map(String))
        const results: SearchResult[] = []
        if (selected.has(SearchResultType.Artist)) for (const artist of data.artists?.items ?? []) {
            results.push(this.result("artist", artist.id, artist.name ?? "Unknown artist", "Artist", artist.picture, downloaded.has(String(artist.id)), { artist: artist.name }, [["Popularity", artist.popularity]]))
        }
        if (selected.has(SearchResultType.Album)) for (const album of data.albums?.items ?? []) {
            results.push(this.result("album", album.id, album.title ?? "Untitled album", [artistNames(album), album.releaseDate?.slice(0, 4)].filter(Boolean).join(" - "), album.cover, downloaded.has(String(album.id)), { artist: artistNames(album), album: album.title }, [["Artist", artistNames(album)], ["Released", album.releaseDate], ["Tracks", album.numberOfTracks], ["Duration", formatDuration(album.duration)], ["Quality", album.audioQuality], ["Modes", album.audioModes?.join(", ")], ["Explicit", album.explicit === undefined ? undefined : album.explicit ? "Yes" : "No"]]))
        }
        if (selected.has(SearchResultType.Song)) for (const track of data.tracks?.items ?? []) {
            results.push(this.result("song", track.id, track.title ?? "Untitled", [artistNames(track), track.album?.title].filter(Boolean).join(" - "), track.album?.cover, downloaded.has(String(track.id)), { artist: artistNames(track), album: track.album?.title, isrc: track.isrc }, [["Artist", artistNames(track)], ["Album", track.album?.title], ["Duration", formatDuration(track.duration)], ["Quality", track.audioQuality], ["Modes", track.audioModes?.join(", ")], ["ISRC", track.isrc], ["Explicit", track.explicit === undefined ? undefined : track.explicit ? "Yes" : "No"]]))
        }
        return { results: results.slice(0, params.limit ?? 20), took: performance.now() - started }
    }

    public async getThumbnail(resultId: string): Promise<ProviderThumbnail> {
        const [, , image] = resultId.split(":", 3)
        if (!image || !/^[a-zA-Z0-9-]+$/.test(image)) throw new Error("Invalid Tidal image ID")
        const url = `https://resources.tidal.com/images/${image.replaceAll("-", "/")}/750x750.jpg`
        const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
        if (!response.ok) throw new Error(`Tidal artwork returned HTTP ${response.status}`)
        const contentType = (response.headers.get("content-type") ?? "application/octet-stream").split(";")[0]
        if (!contentType.startsWith("image/")) throw new Error("Tidal returned non-image artwork")
        return { data: new Uint8Array(await response.arrayBuffer()), contentType }
    }

    public async getActivity(): Promise<ProviderActivity[]> {
        const [queueItems, queueStatus] = await Promise.all([
            this.getQueueItems(),
            this.request<TidarrQueueStatus>("/api/queue/status"),
        ])
        const activeStatuses = new Set(["queue", "queue_download", "download", "queue_processing", "processing"])
        return queueItems.filter((item) => activeStatuses.has(item.status ?? "")).map((item) => {
            const total = item.progress?.total
            const current = item.progress?.current
            const progress = total && total > 0 && typeof current === "number" ? Math.min(Math.max(current / total * 100, 0), 100) : undefined
            return {
                id: `${item.type}-${item.id}`,
                title: [item.artist, item.title].filter(Boolean).join(" - ") || item.id,
                detail: (item.status ?? "Queued").replaceAll("_", " "),
                status: item.error ? "attention" : queueStatus.isPaused && item.status?.startsWith("queue") ? "paused" : item.status === "download" || item.status === "processing" ? "active" : "pending",
                progress,
                trackingIds: [`${item.type}:${item.id}`],
            }
        })
    }

    private async getQueueItems(): Promise<TidarrQueueItem[]> {
        const items: TidarrQueueItem[] = []
        const limit = 100
        let offset = 0
        while (true) {
            const page = await this.request<TidarrQueue & { total?: number }>("/api/queue/list", { offset, limit })
            const queue = page.queue ?? []
            items.push(...queue)
            offset += queue.length
            if (queue.length === 0 || offset >= (page.total ?? offset)) return items
        }
    }

    private result(type: "artist" | "album" | "song", id: string | number, title: string, description: string, image: string | undefined, downloaded: boolean, metadata: Record<string, unknown>, details: [string, unknown][]): SearchResult {
        const resultId = `${type}:${id}`
        return {
            id: resultId,
            provider: this,
            title,
            description,
            thumbnailUrl: image ? thumbnailUrl(this.name, `${resultId}:${image}`) : "",
            actions: [
                { id: "open", label: `Open in ${this.displayName}`, color: Color.Secondary, icon: "box-arrow-up-right" },
                ...(!downloaded ? [{ id: "download", label: `Add to ${this.displayName}`, color: Color.Primary, icon: "download" } as const] : []),
            ],
            meta: { itemType: type === "song" ? "Track" : type[0].toUpperCase() + type.slice(1), tidarrDownloaded: downloaded, tidarrType: type, details: compactDetails([["Tidal ID", id], ["Tidarr", downloaded ? "Previously processed" : undefined], ...details]), ...metadata },
        }
    }

    private parseResultId(resultId: string): ["artist" | "album" | "song", string] {
        const [type, id] = resultId.split(":", 2)
        if (!id || !["artist", "album", "song"].includes(type)) throw new Error("Invalid Tidarr result ID")
        return [type as "artist" | "album" | "song", id]
    }

    private async artistAlbumTrackingIds(artistId: string): Promise<string[]> {
        const ids = new Set<string>()
        for (const filter of ["ALBUMS", "EPSANDSINGLES"]) {
            let offset = 0
            while (true) {
                const page = await this.request<{ items?: TidalAlbum[], totalNumberOfItems?: number }>(`/proxy/tidal/v1/artists/${encodeURIComponent(artistId)}/albums`, {
                    countryCode: this.config.countryCode,
                    filter,
                    limit: 100,
                    offset,
                })
                const items = page.items ?? []
                items.forEach((album) => ids.add(`album:${album.id}`))
                offset += items.length
                if (items.length === 0 || offset >= (page.totalNumberOfItems ?? offset)) break
            }
        }
        return [...ids]
    }

    private async request<T = unknown>(path: string, params: Record<string, string | number> = {}, init: RequestInit = {}, json = true): Promise<T> {
        const url = new URL(`${this.config.url}${path}`)
        for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
        const response = await fetch(url, {
            ...init,
            headers: { accept: "application/json", "content-type": "application/json", "X-Api-Key": this.config.apiKey, ...init.headers },
            signal: AbortSignal.timeout(15_000),
        })
        if (!response.ok) throw new Error(`${this.displayName} returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
        return (json ? response.json() : undefined) as Promise<T>
    }
}

function artistNames(item: { artists?: TidalArtist[], artist?: TidalArtist }): string {
    return (item.artists ?? (item.artist ? [item.artist] : [])).map((artist) => artist.name).filter(Boolean).join(", ")
}

function thumbnailUrl(provider: string, id: string): string {
    return `/api/thumbnail?${new URLSearchParams({ provider, id })}`
}

function compactDetails(entries: [string, unknown][]) {
    return entries.flatMap(([label, value]) => value === undefined || value === null || value === "" ? [] : [{ label, value: String(value) }])
}

function formatDuration(seconds?: number): string | undefined {
    if (!seconds) return undefined
    return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`
}
