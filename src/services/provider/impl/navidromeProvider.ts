import { createHash, randomBytes } from "node:crypto";
import AbstractProvider, { MediaSource, MediaType, SearchResultType, type ProviderDownload, type ProviderThumbnail } from "../abstractProvider.js";
import { Color, SearchResultActionResolutionType, type SearchParams, type SearchResult, type SearchResults } from "../searchManager.js";
import type { NavidromeInstanceConfig } from "../../../config/providerConfig.js";

interface SubsonicArtist {
    id: string
    name?: string
    coverArt?: string
    albumCount?: number
}

interface SubsonicAlbum {
    id: string
    name?: string
    artist?: string
    year?: number
    coverArt?: string
    songCount?: number
    duration?: number
    genre?: string
}

interface SubsonicSong {
    id: string
    title?: string
    artist?: string
    album?: string
    year?: number
    coverArt?: string
    albumId?: string
    isrc?: string[]
    duration?: number
    track?: number
    discNumber?: number
    genre?: string
    suffix?: string
}

interface SearchResult3 {
    artist?: SubsonicArtist[]
    album?: SubsonicAlbum[]
    song?: SubsonicSong[]
}

interface SubsonicResponse {
    status?: "ok" | "failed"
    error?: { code?: number, message?: string }
    searchResult3?: SearchResult3
    similarSongs2?: { song?: SubsonicSong[] }
    playlist?: { id?: string, name?: string, songCount?: number }
    song?: SubsonicSong
}

export default class NavidromeProvider extends AbstractProvider<`navidrome.${string}`> {
    public readonly displayName: string

    constructor(private readonly config: NavidromeInstanceConfig) {
        super(`navidrome.${config.id}`, [MediaType.Music], MediaSource.Local, [SearchResultType.Artist, SearchResultType.Album, SearchResultType.Song], config.icon)
        this.displayName = config.name
        this.registerHandler("open", async (resultId) => ({
            success: true,
            type: SearchResultActionResolutionType.OpenUrl,
            url: await this.openUrl(resultId),
        }))
        this.registerHandler("generate-playlist", async (resultId) => {
            const [type, id] = this.parseResultId(resultId)
            const similar = await this.request("getSimilarSongs2", { id, count: 30 })
            const songIds = [...(type === "song" ? [id] : []), ...(similar.similarSongs2?.song ?? []).map((song) => song.id)]
                .filter((songId, index, all) => all.indexOf(songId) === index)
            if (songIds.length === 0) return {
                success: false,
                type: SearchResultActionResolutionType.Message,
                message: "Navidrome did not find any similar songs for this item.",
                color: Color.Danger,
            }

            const created = await this.request("createPlaylist", {
                name: `Mix - ${type} ${id.slice(0, 8)}`,
                songId: songIds,
            }, "POST")
            if (!created.playlist?.id) throw new Error("Navidrome created the playlist but returned no playlist ID")
            return {
                success: true,
                type: SearchResultActionResolutionType.OpenUrl,
                url: `${this.publicUrl()}/#/playlist/${encodeURIComponent(created.playlist.id)}/show`,
            }
        })
    }

    public async init(): Promise<void> {
        await this.request("ping")
    }

    public async query(params: SearchParams): Promise<SearchResults> {
        const started = performance.now()
        const limit = params.limit ?? 20
        const offset = params.offset ?? 0
        const selected = params.resultTypes.size === 0 ? new Set(this.supportedResultTypes) : params.resultTypes
        const categoryCount = this.supportedResultTypes.filter((type) => selected.has(type)).length
        const categoryLimit = Math.max(Math.ceil(limit / categoryCount), 1)
        const data = await this.request("search3", {
            query: params.query,
            artistCount: selected.has(SearchResultType.Artist) ? categoryLimit : 0,
            artistOffset: offset,
            albumCount: selected.has(SearchResultType.Album) ? categoryLimit : 0,
            albumOffset: offset,
            songCount: selected.has(SearchResultType.Song) ? categoryLimit : 0,
            songOffset: offset,
        })
        const search = data.searchResult3 ?? {}
        const results: SearchResult[] = [
            ...(selected.has(SearchResultType.Artist) ? search.artist ?? [] : []).map((artist) => this.result(`artist:${artist.id}`, artist.name ?? "Unknown artist", "Artist", artist.coverArt, "artist", [["Albums", artist.albumCount]])),
            ...(selected.has(SearchResultType.Album) ? search.album ?? [] : []).map((album) => this.result(`album:${album.id}`, album.name ?? "Untitled album", [album.artist, album.year].filter(Boolean).join(" - "), album.coverArt, "album", [["Artist", album.artist], ["Year", album.year], ["Songs", album.songCount], ["Duration", formatDuration(album.duration)], ["Genre", album.genre]])),
            ...(selected.has(SearchResultType.Song) ? search.song ?? [] : []).map((song) => this.result(`song:${song.id}`, song.title ?? "Untitled", [song.artist, song.album, song.year].filter(Boolean).join(" - "), song.coverArt, "song", [["Artist", song.artist], ["Album", song.album], ["Year", song.year], ["Track", song.track], ["Disc", song.discNumber], ["Duration", formatDuration(song.duration)], ["Format", song.suffix], ["Genre", song.genre], ["ISRC", song.isrc?.join(", ")]])),
        ].slice(0, limit)

        return { results, took: performance.now() - started }
    }

    public async getThumbnail(id: string): Promise<ProviderThumbnail> {
        const response = await fetch(this.url("getCoverArt", { id, size: 400 }), { signal: AbortSignal.timeout(10_000) })
        if (!response.ok) throw new Error(`Navidrome getCoverArt returned HTTP ${response.status}`)
        const contentType = (response.headers.get("content-type") ?? "application/octet-stream").split(";")[0]
        if (!contentType.startsWith("image/")) throw new Error("Navidrome returned a non-image thumbnail")
        return { data: new Uint8Array(await response.arrayBuffer()), contentType }
    }

    public async enrichResult(result: SearchResult): Promise<void> {
        const meta = result.meta as { tidarrDownloaded?: boolean, tidarrType?: string, artist?: string, album?: string, isrc?: string } | undefined
        if (!meta?.tidarrDownloaded || !meta.tidarrType) return
        const data = await this.request("search3", { query: result.title, artistCount: 20, albumCount: 20, songCount: 50 })
        const search = data.searchResult3 ?? {}
        let resultId: string | undefined
        if (meta.tidarrType === "artist") {
            const item = search.artist?.find((artist) => equal(artist.name, result.title))
            if (item) resultId = `artist:${item.id}`
        } else if (meta.tidarrType === "album") {
            const item = search.album?.find((album) => equal(album.name, result.title) && (!meta.artist || equal(album.artist, meta.artist)))
            if (item) resultId = `album:${item.id}`
        } else {
            const item = search.song?.find((song) => meta.isrc
                ? song.isrc?.some((isrc) => equal(isrc, meta.isrc))
                : equal(song.title, result.title) && (!meta.artist || equal(song.artist, meta.artist)) && (!meta.album || equal(song.album, meta.album)))
            if (item) resultId = `song:${item.id}`
        }
        if (resultId) result.actions.unshift({ id: "open", label: `Open in ${this.displayName}`, color: Color.Secondary, icon: "play-fill", provider: this.name, resultId })
    }

    private result(id: string, title: string, description: string, coverArt: string | undefined, itemType: string, details: [string, unknown][]): SearchResult {
        return {
            id,
            provider: this,
            title,
            description,
            thumbnailUrl: coverArt ? thumbnailUrl(this.name, coverArt) : "",
            actions: [
                { id: "open", label: "Open in Navidrome", color: Color.Secondary, icon: "box-arrow-up-right" },
                { id: "browser-download", label: "Download", color: Color.Secondary, icon: "download" },
                { id: "generate-playlist", label: "Generate playlist", color: Color.Primary, icon: "music-note-list" },
            ],
            meta: { itemType, coverArt, details: compactDetails([["ID", id.slice(id.indexOf(":") + 1)], ...details]) },
        }
    }

    private async request(endpoint: string, params: Record<string, string | number | string[] | undefined> = {}, method: "GET" | "POST" = "GET"): Promise<SubsonicResponse> {
        const url = this.url(endpoint, params)
        const requestBody = method === "POST" ? new URLSearchParams(url.searchParams) : undefined
        if (requestBody) url.search = ""
        const response = await fetch(url, {
            method,
            body: requestBody,
            headers: {
                accept: "application/json",
                ...(requestBody ? { "content-type": "application/x-www-form-urlencoded" } : {}),
            },
            signal: AbortSignal.timeout(10_000),
        })
        if (!response.ok) throw new Error(`Navidrome ${endpoint} returned HTTP ${response.status}`)

        const body = await response.json() as { "subsonic-response"?: SubsonicResponse }
        const data = body["subsonic-response"]
        if (!data) throw new Error(`Navidrome ${endpoint} returned an invalid Subsonic response`)
        if (data.status !== "ok") throw new Error(`Navidrome ${endpoint} failed (${data.error?.code ?? "unknown"}): ${data.error?.message ?? "Unknown error"}`)
        return data
    }

    public async getDownload(resultId: string, range?: string): Promise<ProviderDownload> {
        const [, id] = this.parseResultId(resultId)
        const response = await fetch(this.url("download", { id, format: "raw" }), {
            headers: range ? { Range: range } : undefined,
            signal: AbortSignal.timeout(30_000),
        })
        return { response }
    }

    private url(endpoint: string, params: Record<string, string | number | string[] | undefined>): URL {
        const salt = randomBytes(8).toString("hex")
        const token = createHash("md5").update(this.config.password + salt).digest("hex")
        const url = new URL(`${this.config.url}/rest/${endpoint}.view`)
        const common = {
            u: this.config.username,
            t: token,
            s: salt,
            v: this.config.apiVersion,
            c: this.config.client,
            f: "json",
        }
        for (const [key, value] of Object.entries(common)) {
            if (value !== undefined) url.searchParams.set(key, String(value))
        }
        for (const [key, value] of Object.entries(params)) {
            if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, item))
            else if (value !== undefined) url.searchParams.set(key, String(value))
        }
        return url
    }

    private parseResultId(resultId: string): ["artist" | "album" | "song", string] {
        const separator = resultId.indexOf(":")
        const type = resultId.slice(0, separator)
        const id = resultId.slice(separator + 1)
        if (!id || !["artist", "album", "song"].includes(type)) throw new Error("Invalid Navidrome result ID")
        return [type as "artist" | "album" | "song", id]
    }

    private async openUrl(resultId: string): Promise<string> {
        const [type, id] = this.parseResultId(resultId)
        if (type === "song") {
            const song = await this.request("getSong", { id })
            return song.song?.albumId
                ? `${this.publicUrl()}/#/album/${encodeURIComponent(song.song.albumId)}/show`
                : `${this.publicUrl()}/#/song`
        }
        return `${this.publicUrl()}/#/${type}/${encodeURIComponent(id)}/show`
    }

    private publicUrl(): string {
        return this.config.publicUrl
    }
}

function thumbnailUrl(provider: string, id: string): string {
    return `/api/thumbnail?${new URLSearchParams({ provider, id })}`
}

function equal(left: string | undefined, right: string | undefined): boolean {
    return left?.normalize().toLowerCase().trim() === right?.normalize().toLowerCase().trim()
}

function compactDetails(entries: [string, unknown][]) {
    return entries.flatMap(([label, value]) => value === undefined || value === null || value === "" ? [] : [{ label, value: String(value) }])
}

function formatDuration(seconds?: number): string | undefined {
    if (!seconds) return undefined
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}
