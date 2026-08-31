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
    results: SearchResults[]
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

export interface SearchResultActioOpenUrlResolution extends BaseSearchResultActionResolution {
    type: SearchResultActionResolutionType.Message,
    message: string
    color: Color
}

export interface SearchResultActionMessageResolution extends BaseSearchResultActionResolution {
    type: SearchResultActionResolutionType.OpenUrl,
    url: string
}

export enum SearchResultActionResolutionType {
    OpenUrl,
    Message,
    Embed
}
