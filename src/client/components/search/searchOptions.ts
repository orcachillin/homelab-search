import Core from "../../../core.js";
import { MediaSource, MediaType, SearchResultType } from "../../../services/provider/abstractProvider.js";

export interface SearchProps {
	query?: string
	providers?: string | string[]
	mediaTypes?: string | string[]
	sources?: string | string[]
	resultTypes?: string | string[]
	limit?: string
}

export const mediaOptions = [
	[MediaType.Music, "Music"],
	[MediaType.Movie, "Movies"],
	[MediaType.TvShow, "TV"],
	[MediaType.Anime, "Anime"],
	[MediaType.Video, "Video"],
	[MediaType.Book, "Books"],
	[MediaType.AudioBook, "Audiobooks"],
] as const;

export const sourceOptions = [
	[MediaSource.Local, "On server"],
	[MediaSource.Download, "Downloads"],
	[MediaSource.Streamed, "Streams"],
] as const;

export const resultTypeOptions = [
	[SearchResultType.Artist, "Artist"],
	[SearchResultType.Album, "Album"],
	[SearchResultType.Song, "Song"],
	[SearchResultType.Person, "Person"],
] as const;

export function values(value?: string | string[]): string[] {
	return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

export function selected(value: string | string[] | undefined, option: string): boolean {
	return values(value).includes(option);
}

export function isMediaType(value: number): value is MediaType {
	return Number.isInteger(value) && value >= MediaType.Music && value <= MediaType.AudioBook;
}

export function isMediaSource(value: number): value is MediaSource {
	return Number.isInteger(value) && value >= MediaSource.Local && value <= MediaSource.Streamed;
}

export function isResultType(value: string): value is SearchResultType {
	return Object.values(SearchResultType).includes(value as SearchResultType);
}

export function providersSupportingMedia(mediaType: MediaType): string {
	return Core.services.provider.providerList
		.filter((provider) => provider.supportedMediaTypes.includes(mediaType))
		.map((provider) => provider.name)
		.join(",");
}

export function providersSupportingResult(resultType: SearchResultType): string {
	return Core.services.provider.providerList
		.filter((provider) => provider.supportedResultTypes.includes(resultType))
		.map((provider) => provider.name)
		.join(",");
}
