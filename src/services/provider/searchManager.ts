import AbstractProvider, { MediaSource, MediaType, SearchResultType } from "./abstractProvider.js"
import { Logger } from "../../util/logger.js"

export default class SearchManager {
    private readonly logger = new Logger("SearchManager")

    constructor(private readonly getProviders: () => readonly AbstractProvider<string>[]) { }

    public async search(params: SearchParams): Promise<SearchResults> {
        const started = performance.now()
        const query = params.query.trim()
        if (!query) throw new Error("Search query cannot be empty")

        const normalizedParams = {
            ...params,
            query,
            limit: Math.min(Math.max(params.limit ?? 20, 1), 100),
            offset: Math.max(params.offset ?? 0, 0),
        }
        const providers: AbstractProvider<string>[] = []
        for (const provider of this.getProviders()) {
            if (await provider.shouldUse(normalizedParams)) providers.push(provider)
        }

        const settled = await Promise.allSettled(providers.map((provider) => provider.query(normalizedParams)))
        const results: SearchResult[] = []
        settled.forEach((result, index) => {
            if (result.status === "fulfilled") {
                results.push(...result.value.results)
            } else {
                this.logger.error(`Provider ${providers[index].name} search failed:`, result.reason)
            }
        })

        const enrichments = await Promise.allSettled(results.flatMap((result) =>
            this.getProviders().map((provider) => provider.enrichResult(result))))
        for (const enrichment of enrichments) {
            if (enrichment.status === "rejected") this.logger.warn("Result enrichment failed:", enrichment.reason)
        }
        for (const result of results) {
            const meta = result.meta as { availableInJellyfin?: boolean } | undefined
            if (meta?.availableInJellyfin) result.actions = result.actions.filter((action) => action.id !== "download")
        }

        return { results, took: performance.now() - started }
    }

}

export interface SearchParams {
    type: AutodetectedSearchType,
    query: string,
    providers: Set<string>
    mediaTypes: Set<MediaType>
    sources: Set<MediaSource>
    resultTypes: Set<SearchResultType>

    limit?: number
    offset?: number
}

export enum AutodetectedSearchType {
    Text,
    Url
}

export interface SearchResults {
    results: SearchResult[]
    took: number
}

export interface SearchResult<Meta extends Record<string, any> = {}> {
    id: string,
    meta?: Meta
    provider: AbstractProvider<string>
    title: string,
    description: string,
    thumbnailUrl: string,
    actions: SearchResultAction[]
}

export interface SearchResultDetail {
    label: string
    value: string
}

export enum Color {
    Primary = "primary",
    Secondary = "secondary",
    Success = "success",
    Danger = "danger",
}

export interface SearchResultAction {
    id: string,
    label: string,
    color: Color, // primary, secondary, danger, etc
    provider?: string
    resultId?: string
    icon?: string
}

export interface BaseSearchResultActionResolution {
    success: boolean
    activityTrackingId?: string
    activityTrackingIds?: string[]
}

export interface SearchResultActionOpenUrlResolution extends BaseSearchResultActionResolution {
    type: SearchResultActionResolutionType.OpenUrl,
    url: string
}

export interface SearchResultActionMessageResolution extends BaseSearchResultActionResolution {
    type: SearchResultActionResolutionType.Message,
    message: string
    color: Color
}

export type SearchResultActionResolution =
    SearchResultActionMessageResolution
    | SearchResultActionOpenUrlResolution

export enum SearchResultActionResolutionType {
    OpenUrl,
    Message,
    Embed
}

export type SearchResultActionHandler<Meta extends Record<string, any> = {}> = (resultId: string, meta?: Meta) => Promise<SearchResultActionResolution>
