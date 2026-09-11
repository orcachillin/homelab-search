import AbstractProvider, { MediaSource, MediaType } from "./abstractProvider.js"

export default class SearchManager {

}

export interface SearchParams {
    type: AutodetectedSearchType,
    query: string,
    providers: Set<string>
    mediaTypes: Set<MediaType>
    sources: Set<MediaSource>

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
}

export interface BaseSearchResultActionResolution {
    success: boolean
}

export interface SearchResultActionOpenUrlResolution extends BaseSearchResultActionResolution {
    type: SearchResultActionResolutionType.Message,
    message: string
    color: Color
}

export interface SearchResultActionMessageResolution extends BaseSearchResultActionResolution {
    type: SearchResultActionResolutionType.OpenUrl,
    url: string
}

export type SearchResultActionResolution =
    SearchResultActionMessageResolution
    | SearchResultActionOpenUrlResolution

export enum SearchResultActionResolutionType {
    OpenUrl,
    Message,
    Embed
}

export type SearchResultActionHandler<Meta extends Record<string, any> = {}> = (id: string, meta: Meta) => Promise<SearchResultActionResolution>