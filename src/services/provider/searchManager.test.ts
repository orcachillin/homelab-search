import assert from "node:assert/strict"
import test from "node:test"
import AbstractProvider, { MediaSource, MediaType, SearchResultType } from "./abstractProvider.js"
import SearchManager, { AutodetectedSearchType, type SearchParams, type SearchResults } from "./searchManager.js"

class TestProvider extends AbstractProvider<string> {
    public readonly displayName: string

    constructor(name: string, mediaTypes: MediaType[], source: MediaSource) {
        super(name, mediaTypes, source, Object.values(SearchResultType))
        this.displayName = name
    }

    public async init(): Promise<void> { }

    public async query(params: SearchParams): Promise<SearchResults> {
        return {
            results: [{
                id: `${this.name}:result`,
                provider: this,
                title: params.query,
                description: "",
                thumbnailUrl: "",
                actions: [],
            }],
            took: 0,
        }
    }
}

const params = (overrides: Partial<SearchParams> = {}): SearchParams => ({
    type: AutodetectedSearchType.Text,
    query: "  test query  ",
    providers: new Set(),
    mediaTypes: new Set(),
    sources: new Set(),
    resultTypes: new Set(),
    ...overrides,
})

test("empty filters query every ready provider", async () => {
    const providers = [
        new TestProvider("music", [MediaType.Music], MediaSource.Local),
        new TestProvider("movies", [MediaType.Movie], MediaSource.Streamed),
    ]
    const result = await new SearchManager(() => providers).search(params())

    assert.deepEqual(result.results.map(({ id }) => id), ["music:result", "movies:result"])
    assert.equal(result.results[0].title, "test query")
    assert.ok(result.took >= 0)
})

test("provider, media, and source filters are all applied", async () => {
    const providers = [
        new TestProvider("local-music", [MediaType.Music], MediaSource.Local),
        new TestProvider("streamed-music", [MediaType.Music], MediaSource.Streamed),
        new TestProvider("local-movies", [MediaType.Movie], MediaSource.Local),
    ]
    const result = await new SearchManager(() => providers).search(params({
        providers: new Set(["local-music", "streamed-music"]),
        mediaTypes: new Set([MediaType.Music]),
        sources: new Set([MediaSource.Local]),
    }))

    assert.deepEqual(result.results.map(({ id }) => id), ["local-music:result"])
})

test("empty queries are rejected", async () => {
    const manager = new SearchManager(() => [])
    await assert.rejects(manager.search(params({ query: "  " })), /cannot be empty/)
})
