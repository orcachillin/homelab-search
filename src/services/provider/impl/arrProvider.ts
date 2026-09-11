import AbstractProvider, { MediaSource, MediaType, type ProviderActivity, type ProviderThumbnail } from "../abstractProvider.js"
import { Color, SearchResultActionResolutionType, type SearchParams, type SearchResult, type SearchResults } from "../searchManager.js"
import type { RadarrInstanceConfig, SonarrInstanceConfig } from "../../../config/providerConfig.js"

interface ArrImage {
    coverType?: string
    url?: string
    remoteUrl?: string
}

interface ArrLookupResult {
    id?: number
    title?: string
    year?: number
    titleSlug?: string
    tvdbId?: number
    tmdbId?: number
    seriesType?: string
    overview?: string
    status?: string
    runtime?: number
    genres?: string[]
    network?: string
    studio?: string
    ratings?: { value?: number }
    images?: ArrImage[]
    remotePoster?: string
    [key: string]: unknown
}

interface RootFolder {
    path?: string
    accessible?: boolean
}

interface QualityProfile {
    id?: number
}

interface ArrCommand { id?: number, name?: string, commandName?: string, message?: string, status?: string, body?: { seriesId?: number, movieId?: number, movieIds?: number[] } }
interface ArrQueueRecord { id?: number, seriesId?: number, movieId?: number, title?: string, status?: string, trackedDownloadState?: string, trackedDownloadStatus?: string, size?: number, sizeleft?: number, timeleft?: string, errorMessage?: string }
interface ArrQueue { totalRecords?: number, records?: ArrQueueRecord[] }

type ArrConfig = SonarrInstanceConfig | RadarrInstanceConfig

export default class ArrProvider extends AbstractProvider<string> {
    public readonly displayName: string
    private readonly isSonarr: boolean

    constructor(private readonly config: ArrConfig) {
        const isSonarr = config.type === "sonarr"
        const mediaTypes = isSonarr
            ? config.media.map((type) => type === "anime" ? MediaType.Anime : MediaType.TvShow)
            : [MediaType.Movie]
        super(`${config.type}.${config.id}`, mediaTypes, MediaSource.Download, [], config.icon)
        this.isSonarr = isSonarr
        this.displayName = config.name
        this.registerHandler("download", async (resultId) => {
            const externalId = this.parseResultId(resultId)
            const lookup = await this.lookupById(externalId)
            const added = await this.add(lookup)
            if (!added.titleSlug) throw new Error(`${this.displayName} added the item but returned no title slug`)
            return {
                success: true,
                type: SearchResultActionResolutionType.OpenUrl,
                url: `${this.config.publicUrl}/${this.isSonarr ? "series" : "movie"}/${encodeURIComponent(added.titleSlug)}`,
                activityTrackingId: `${this.isSonarr ? "series" : "movie"}:${added.id}`,
            }
        })
    }

    public async init(): Promise<void> {
        await Promise.all([this.request<RootFolder[]>("rootfolder"), this.request<QualityProfile[]>("qualityprofile")])
    }

    public async query(params: SearchParams): Promise<SearchResults> {
        const started = performance.now()
        const results = await this.request<ArrLookupResult[]>(`${this.isSonarr ? "series" : "movie"}/lookup`, { term: params.query })
        const offset = params.offset ?? 0
        const limit = params.limit ?? 20
        return {
            results: results.slice(offset, offset + limit).flatMap((item) => {
                const externalId = this.isSonarr ? item.tvdbId : item.tmdbId
                if (!externalId || !item.title || !this.supports(item)) return []
                const id = `${this.isSonarr ? "tvdb" : "tmdb"}:${externalId}`
                const poster = item.images?.find((image) => image.coverType === "poster")
                return [{
                    id,
                    provider: this,
                    title: item.title,
                    description: [item.year, item.overview].filter(Boolean).join(" - "),
                    thumbnailUrl: poster || item.remotePoster ? thumbnailUrl(this.name, id) : "",
                    actions: [{ id: "download", label: `Add to ${this.displayName}`, color: Color.Primary, icon: "download" }],
                    meta: {
                        itemType: this.isSonarr ? (item.seriesType === "anime" ? "Anime" : "Series") : "Movie",
                        externalProvider: this.isSonarr ? "Tvdb" : "Tmdb",
                        externalId,
                        details: compactDetails([
                            [this.isSonarr ? "TVDB" : "TMDB", String(externalId)],
                            ["Year", item.year],
                            ["Status", item.status],
                            ["Type", item.seriesType],
                            ["Runtime", item.runtime ? `${item.runtime} min` : undefined],
                            [this.isSonarr ? "Network" : "Studio", this.isSonarr ? item.network : item.studio],
                            ["Rating", item.ratings?.value?.toFixed(1)],
                            ["Genres", item.genres?.join(", ")],
                        ]),
                    },
                } satisfies SearchResult]
            }),
            took: performance.now() - started,
        }
    }

    public async getThumbnail(resultId: string): Promise<ProviderThumbnail> {
        const item = await this.lookupById(this.parseResultId(resultId))
        const poster = item.images?.find((image) => image.coverType === "poster")
        const source = poster?.remoteUrl ?? poster?.url ?? item.remotePoster
        if (!source) throw new Error(`${this.displayName} returned no poster`)
        const url = new URL(source, `${this.config.url}/`)
        const response = await fetch(url, { headers: { "X-Api-Key": this.config.apiKey }, signal: AbortSignal.timeout(10_000) })
        if (!response.ok) throw new Error(`${this.displayName} poster returned HTTP ${response.status}`)
        const contentType = (response.headers.get("content-type") ?? "application/octet-stream").split(";")[0]
        if (!contentType.startsWith("image/")) throw new Error(`${this.displayName} returned a non-image poster`)
        return { data: new Uint8Array(await response.arrayBuffer()), contentType }
    }

    public async getActivity(): Promise<ProviderActivity[]> {
        const [commands, queue] = await Promise.all([
            this.request<ArrCommand[]>("command"),
            this.request<ArrQueue>("queue", { page: 1, pageSize: 20, [this.isSonarr ? "includeUnknownSeriesItems" : "includeUnknownMovieItems"]: "true" }),
        ])
        const activity: ProviderActivity[] = commands
            .filter((command) => command.status === "queued" || command.status === "started")
            .map((command) => ({
                id: `command-${command.id ?? command.name}`,
                title: command.commandName ?? command.name ?? "Command",
                detail: command.message ?? (command.status === "queued" ? "Queued" : "Running"),
                status: command.status === "queued" ? "pending" : "active",
                trackingIds: [
                    ...(command.body?.seriesId ? [`series:${command.body.seriesId}`] : []),
                    ...(command.body?.movieId ? [`movie:${command.body.movieId}`] : []),
                    ...(command.body?.movieIds ?? []).map((id) => `movie:${id}`),
                ],
            }))
        activity.push(...(queue.records ?? []).map((item): ProviderActivity => {
            const progress = item.size && item.size > 0 && typeof item.sizeleft === "number"
                ? Math.min(Math.max(100 - item.sizeleft / item.size * 100, 0), 100)
                : undefined
            const attention = item.status === "failed" || item.status === "warning" || item.status === "downloadClientUnavailable" || item.trackedDownloadStatus === "error"
            return {
                id: `queue-${item.id ?? item.title}`,
                title: item.title ?? "Download",
                detail: item.errorMessage ?? [item.status, item.trackedDownloadState, item.timeleft].filter(Boolean).join(" - "),
                status: attention ? "attention" : item.status === "downloading" || item.trackedDownloadState === "importing" ? "active" : item.status === "paused" ? "paused" : "pending",
                progress,
                trackingIds: [
                    ...(item.seriesId ? [`series:${item.seriesId}`] : []),
                    ...(item.movieId ? [`movie:${item.movieId}`] : []),
                ],
            }
        }))
        return activity
    }

    private supports(item: ArrLookupResult): boolean {
        if (!this.isSonarr) return true
        const config = this.config as SonarrInstanceConfig
        return item.seriesType === "anime" ? config.media.includes("anime") : config.media.includes("tv")
    }

    private async add(item: ArrLookupResult): Promise<ArrLookupResult> {
        const [rootFolders, qualityProfiles] = await Promise.all([
            this.request<RootFolder[]>("rootfolder"),
            this.request<QualityProfile[]>("qualityprofile"),
        ])
        const rootFolderPath = this.config.rootFolder ?? rootFolders.find((folder) => folder.accessible !== false && folder.path)?.path
        const qualityProfileId = this.config.qualityProfileId ?? qualityProfiles.find((profile) => profile.id)?.id
        if (!rootFolderPath) throw new Error(`${this.displayName} has no accessible root folder`)
        if (!qualityProfileId) throw new Error(`${this.displayName} has no quality profile`)

        const body = this.isSonarr ? {
            ...item,
            id: 0,
            qualityProfileId,
            rootFolderPath,
            seriesType: item.seriesType === "anime" ? "anime" : item.seriesType ?? "standard",
            seasonFolder: true,
            monitored: true,
            monitorNewItems: "all",
            tags: [],
            addOptions: { monitor: "all", searchForMissingEpisodes: true, searchForCutoffUnmetEpisodes: false },
        } : {
            ...item,
            id: 0,
            qualityProfileId,
            rootFolderPath,
            monitored: true,
            minimumAvailability: "released",
            tags: [],
            addOptions: { monitor: "movieOnly", searchForMovie: true, addMethod: "manual" },
        }
        return this.request<ArrLookupResult>(this.isSonarr ? "series" : "movie", undefined, { method: "POST", body: JSON.stringify(body) })
    }

    private lookupById(id: number): Promise<ArrLookupResult> {
        if (this.isSonarr) return this.request<ArrLookupResult[]>("series/lookup", { term: `tvdb:${id}` }).then((items) => {
            const item = items.find((candidate) => candidate.tvdbId === id)
            if (!item) throw new Error(`Series ${id} was not found`)
            return item
        })
        return this.request<ArrLookupResult>("movie/lookup/tmdb", { tmdbId: id })
    }

    private parseResultId(resultId: string): number {
        const [prefix, rawId] = resultId.split(":", 2)
        const id = Number(rawId)
        if (prefix !== (this.isSonarr ? "tvdb" : "tmdb") || !Number.isInteger(id) || id <= 0) throw new Error(`Invalid ${this.displayName} result ID`)
        return id
    }

    private async request<T>(path: string, params?: Record<string, string | number>, init: RequestInit = {}): Promise<T> {
        const url = new URL(`${this.config.url}/api/v3/${path}`)
        for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, String(value))
        const response = await fetch(url, {
            ...init,
            headers: { accept: "application/json", "content-type": "application/json", "X-Api-Key": this.config.apiKey, ...init.headers },
            signal: AbortSignal.timeout(15_000),
        })
        if (!response.ok) {
            const message = await response.text()
            throw new Error(`${this.displayName} returned HTTP ${response.status}${message ? `: ${message.slice(0, 300)}` : ""}`)
        }
        return response.json() as Promise<T>
    }
}

function thumbnailUrl(provider: string, id: string): string {
    return `/api/thumbnail?${new URLSearchParams({ provider, id })}`
}

function compactDetails(entries: [string, unknown][]) {
    return entries.flatMap(([label, value]) => value === undefined || value === null || value === "" ? [] : [{ label, value: String(value) }])
}
