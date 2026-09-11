import assert from "node:assert/strict"
import { writeFile, unlink } from "node:fs/promises"
import test from "node:test"
import { loadProviderConfig } from "./providerConfig.js"

const path = `/tmp/homelab-search-provider-config-${process.pid}.toml`

test("loads multiple provider instances", async () => {
    await writeFile(path, `
[[providers]]
type = "jellyfin"
id = "home"
name = "Home TV"
url = "http://jellyfin:8096"
public_url = "https://jellyfin.example.com"
api_key = "secret"

[[providers]]
type = "jellyfin"
id = "remote"
url = "https://remote.example.com"
username = "user"
password = "pass"

[[providers]]
type = "navidrome"
id = "music"
url = "http://navidrome:4533"
username = "user"
password = "pass"

[[providers]]
type = "sonarr"
id = "shows"
url = "http://sonarr:8989"
api_key = "secret"
media = ["tv", "anime"]

[[providers]]
type = "radarr"
id = "movies"
url = "http://radarr:7878"
api_key = "secret"

[[providers]]
type = "tidarr"
id = "tidal"
url = "http://tidarr:8484"
api_key = "secret"
country_code = "gb"
`)

    try {
        const providers = await loadProviderConfig(path)
        assert.equal(providers.length, 6)
        assert.deepEqual(providers.map(({ type, id }) => `${type}.${id}`), ["jellyfin.home", "jellyfin.remote", "navidrome.music", "sonarr.shows", "radarr.movies", "tidarr.tidal"])
        assert.equal(providers[1].publicUrl, "https://remote.example.com")
        assert.deepEqual(providers[3].type === "sonarr" ? providers[3].media : [], ["tv", "anime"])
        assert.equal(providers[5].type === "tidarr" ? providers[5].countryCode : "", "GB")
    } finally {
        await unlink(path)
    }
})

test("rejects invalid Sonarr media capabilities", async () => {
    await writeFile(path, `
[[providers]]
type = "sonarr"
id = "shows"
url = "http://sonarr:8989"
api_key = "secret"
media = ["movies"]
`)

    try {
        await assert.rejects(loadProviderConfig(path), /media must contain tv, anime, or both/)
    } finally {
        await unlink(path)
    }
})

test("rejects duplicate provider instance IDs", async () => {
    await writeFile(path, `
[[providers]]
type = "jellyfin"
id = "home"
url = "http://one"
api_key = "secret"

[[providers]]
type = "jellyfin"
id = "home"
url = "http://two"
api_key = "secret"
`)

    try {
        await assert.rejects(loadProviderConfig(path), /duplicate provider instance jellyfin.home/)
    } finally {
        await unlink(path)
    }
})
