import { MediaSource, MediaType, SearchResultType } from "./abstractProvider.js"

export interface ParsedSearchSyntax {
    query: string
    providers: string[]
    mediaTypes: MediaType[]
    sources: MediaSource[]
    resultTypes: SearchResultType[]
    limit?: number
}

const mediaAliases: Record<string, MediaType> = {
    music: MediaType.Music,
    movie: MediaType.Movie,
    movies: MediaType.Movie,
    tv: MediaType.TvShow,
    show: MediaType.TvShow,
    shows: MediaType.TvShow,
    anime: MediaType.Anime,
    video: MediaType.Video,
    videos: MediaType.Video,
    book: MediaType.Book,
    books: MediaType.Book,
    audiobook: MediaType.AudioBook,
    audiobooks: MediaType.AudioBook,
}

const sourceAliases: Record<string, MediaSource> = {
    local: MediaSource.Local,
    server: MediaSource.Local,
    download: MediaSource.Download,
    downloads: MediaSource.Download,
    stream: MediaSource.Streamed,
    streamed: MediaSource.Streamed,
}

const resultAliases: Record<string, SearchResultType> = {
    artist: SearchResultType.Artist,
    album: SearchResultType.Album,
    song: SearchResultType.Song,
    track: SearchResultType.Song,
    person: SearchResultType.Person,
}

export function parseSearchSyntax(query: string, providerNames: readonly string[]): ParsedSearchSyntax {
    const providers: string[] = []
    const mediaTypes: MediaType[] = []
    const sources: MediaSource[] = []
    const resultTypes: SearchResultType[] = []
    let limit: number | undefined
    const searchTerms: string[] = []

    for (const token of query.trim().split(/\s+/).filter(Boolean)) {
        const match = /^(provider|media|source|type|limit):(.+)$/i.exec(token)
        if (!match) {
            searchTerms.push(token)
            continue
        }

        const key = match[1].toLowerCase()
        const values = match[2].toLowerCase().split(",").filter(Boolean)
        let recognized = false
        for (const value of values) {
            if (key === "provider") {
                const matches = providerNames.filter((name) => name.toLowerCase() === value || name.toLowerCase().startsWith(`${value}.`))
                if (matches.length > 0) {
                    providers.push(...matches)
                    recognized = true
                }
            } else if (key === "media" && value in mediaAliases) {
                mediaTypes.push(mediaAliases[value])
                recognized = true
            } else if (key === "source" && value in sourceAliases) {
                sources.push(sourceAliases[value])
                recognized = true
            } else if (key === "type" && value in resultAliases) {
                resultTypes.push(resultAliases[value])
                recognized = true
            } else if (key === "limit" && /^\d+$/.test(value)) {
                limit = Math.min(Math.max(Number.parseInt(value, 10), 1), 100)
                recognized = true
            }
        }

        if (!recognized) searchTerms.push(token)
    }

    return {
        query: searchTerms.join(" "),
        providers: [...new Set(providers)],
        mediaTypes: [...new Set(mediaTypes)],
        sources: [...new Set(sources)],
        resultTypes: [...new Set(resultTypes)],
        limit,
    }
}
