import { SearchParams, SearchResult, SearchResultActionHandler, SearchResultActionResolution, SearchResults } from "./searchManager.js";

export default abstract class AbstractProvider<Name extends string> {

    abstract readonly displayName: string

    protected handlers: Map<string, SearchResultActionHandler<any>> = new Map()

    constructor(public readonly name: Name, public readonly supportedMediaTypes: MediaType[], public readonly sourceType: MediaSource) {

    }

    public abstract init(): Promise<void>
    public abstract query(params: SearchParams): Promise<SearchResults>

    public async shouldUse(params: SearchParams): Promise<boolean> {
        return params.providers.has(this.name)
            && this.supportedMediaTypes.some((t) => params.mediaTypes.has(t))
            && params.sources.has(this.sourceType)
    }

    public registerHandler<Meta extends Record<string, any> = {}>(id: string, method: SearchResultActionHandler<Meta>) {
        this.handlers.set(id, method)
    }

    public invokeHandler(id: string, meta: Record<string, any>): Promise<SearchResultActionResolution> {
        return new Promise(async (resolve, reject) => {
            if (!this.handlers.has(id)) return reject(class ProviderActionHandlerNotFoundError extends Error {
                constructor() {
                    super(`Provider action handler with id ${id} not found`)
                }
            })

            resolve(await this.handlers.get(id)!(id, meta))
        })
    }

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