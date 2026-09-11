import assert from "node:assert/strict"
import test from "node:test"
import { MediaSource, MediaType, SearchResultType } from "./abstractProvider.js"
import { parseSearchSyntax } from "./searchSyntax.js"

test("extracts inline filters and preserves normal terms", () => {
    const parsed = parseSearchSyntax(
        "dark side media:music provider:jellyfin type:album source:local limit:50",
        ["jellyfin.home", "jellyfin.remote", "navidrome.music"]
    )
    assert.equal(parsed.query, "dark side")
    assert.deepEqual(parsed.providers, ["jellyfin.home", "jellyfin.remote"])
    assert.deepEqual(parsed.mediaTypes, [MediaType.Music])
    assert.deepEqual(parsed.sources, [MediaSource.Local])
    assert.deepEqual(parsed.resultTypes, [SearchResultType.Album])
    assert.equal(parsed.limit, 50)
})

test("clamps inline limits", () => {
    assert.equal(parseSearchSyntax("test limit:500", []).limit, 100)
    assert.equal(parseSearchSyntax("test limit:0", []).limit, 1)
})

test("supports comma-separated and repeated filter values", () => {
    const parsed = parseSearchSyntax(
        "star wars provider:jellyfin,radarr media:movie,tv type:person type:album source:local,download",
        ["jellyfin.home", "radarr.movies", "sonarr.shows"]
    )
    assert.equal(parsed.query, "star wars")
    assert.deepEqual(parsed.providers, ["jellyfin.home", "radarr.movies"])
    assert.deepEqual(parsed.mediaTypes, [MediaType.Movie, MediaType.TvShow])
    assert.deepEqual(parsed.resultTypes, [SearchResultType.Person, SearchResultType.Album])
    assert.deepEqual(parsed.sources, [MediaSource.Local, MediaSource.Download])
})

test("supports exact provider instances and leaves unknown filters searchable", () => {
    const parsed = parseSearchSyntax("alien provider:jellyfin.remote media:games", ["jellyfin.home", "jellyfin.remote"])
    assert.equal(parsed.query, "alien media:games")
    assert.deepEqual(parsed.providers, ["jellyfin.remote"])
})
