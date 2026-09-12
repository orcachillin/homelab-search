import type { SearchParams, SearchResult, SearchResultActionHandler, SearchResultActionResolution, SearchResults } from "./searchManager.js";

export default abstract class AbstractProvider<Name extends string> {

    abstract readonly displayName: string

    protected handlers: Map<string, SearchResultActionHandler<any>> = new Map()

    constructor(
        public readonly name: Name,
        public readonly supportedMediaTypes: MediaType[],
        public readonly sourceType: MediaSource,
        public readonly supportedResultTypes: SearchResultType[] = [],
        public readonly icon?: string
    ) {

    }

    public abstract init(): Promise<void>
    public abstract query(params: SearchParams): Promise<SearchResults>

    public async getThumbnail(_id: string): Promise<ProviderThumbnail> {
        throw new Error(`Provider ${this.name} does not support thumbnails`)
    }

    public async enrichResult(_result: SearchResult): Promise<void> { }

    public async getActivity(): Promise<ProviderActivity[]> { return [] }

    public async getDownload(_id: string, _range?: string): Promise<ProviderDownload> {
        throw new Error(`Provider ${this.name} does not support browser downloads`)
    }

    public async shouldUse(params: SearchParams): Promise<boolean> {
        return (params.providers.size === 0 || params.providers.has(this.name))
            && (params.mediaTypes.size === 0 || this.supportedMediaTypes.some((t) => params.mediaTypes.has(t)))
            && (params.sources.size === 0 || params.sources.has(this.sourceType))
            && (params.resultTypes.size === 0 || this.supportedResultTypes.some((t) => params.resultTypes.has(t)))
    }

    public registerHandler<Meta extends Record<string, any> = {}>(id: string, method: SearchResultActionHandler<Meta>) {
        this.handlers.set(id, method)
    }

    public async invokeHandler(actionId: string, resultId: string): Promise<SearchResultActionResolution> {
        const handler = this.handlers.get(actionId)
        if (!handler) throw new Error(`Provider action handler with id ${actionId} not found`)
        return handler(resultId)
    }

}

export interface ProviderThumbnail {
    data: Uint8Array
    contentType: string
}

export interface ProviderActivity {
    id: string
    title: string
    detail: string
    status: "pending" | "active" | "paused" | "attention"
    progress?: number
    trackingIds: string[]
}

export interface ProviderDownload {
    response: Response
    filename?: string
}

export enum MediaType {
    Music,
    TvShow,
    Anime,
    Movie,
    Video,
    Book,
    AudioBook
}

export enum MediaSource {
    /**
     * Media is already on media server
     */
    Local,
    /**
     * Triggers an action that downloads media onto the server. 
     * This could be via something like radarr, ytdl, or tidarr
     */
    Download,
    /**
     * This is media that will be directly streamed from a cloud provider
     * in most cases this will be served from ytdlp, but maybe i add direct streams from
     * torbox? who knows
     */
    Streamed
}

export enum SearchResultType {
    Artist = "artist",
    Album = "album",
    Song = "song",
    Person = "person",
}
