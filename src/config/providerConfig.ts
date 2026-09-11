import { readFile } from "node:fs/promises"
import { parse } from "smol-toml"

export interface JellyfinInstanceConfig {
    type: "jellyfin"
    id: string
    name: string
    url: string
    publicUrl: string
    apiKey?: string
    username?: string
    password?: string
    icon: string
}

export interface NavidromeInstanceConfig {
    type: "navidrome"
    id: string
    name: string
    url: string
    publicUrl: string
    username: string
    password: string
    client: string
    apiVersion: string
    icon: string
}

interface ArrInstanceConfig {
    id: string
    name: string
    url: string
    publicUrl: string
    apiKey: string
    rootFolder?: string
    qualityProfileId?: number
    icon: string
}

export interface SonarrInstanceConfig extends ArrInstanceConfig {
    type: "sonarr"
    media: ("tv" | "anime")[]
}

export interface RadarrInstanceConfig extends ArrInstanceConfig {
    type: "radarr"
}

export interface TidarrInstanceConfig {
    type: "tidarr"
    id: string
    name: string
    url: string
    publicUrl: string
    apiKey: string
    countryCode: string
    icon: string
}

export type ProviderInstanceConfig = JellyfinInstanceConfig | NavidromeInstanceConfig | SonarrInstanceConfig | RadarrInstanceConfig | TidarrInstanceConfig

interface RawConfig {
    providers?: unknown
}

export async function loadProviderConfig(path = process.env.CONFIG_PATH ?? "/config/config.toml"): Promise<ProviderInstanceConfig[]> {
    let source: string
    try {
        source = await readFile(path, "utf8")
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
        throw error
    }

    const parsed = parse(source) as RawConfig
    if (parsed.providers === undefined) return []
    if (!Array.isArray(parsed.providers)) throw new Error("config.toml: providers must be an array of tables")

    const providers = parsed.providers.map((value, index) => normalizeProvider(value, index))
    const names = new Set<string>()
    for (const provider of providers) {
        const key = `${provider.type}.${provider.id}`
        if (names.has(key)) throw new Error(`config.toml: duplicate provider instance ${key}`)
        names.add(key)
    }
    return providers
}

function normalizeProvider(value: unknown, index: number): ProviderInstanceConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`config.toml: providers[${index}] must be a table`)
    const raw = value as Record<string, unknown>
    const type = requiredString(raw, "type", index)
    const id = requiredString(raw, "id", index)
    if (!/^[a-z0-9_-]+$/.test(id)) throw new Error(`config.toml: providers[${index}].id must contain only lowercase letters, numbers, underscores, or hyphens`)
    const url = validUrl(requiredString(raw, "url", index), `providers[${index}].url`)
    const publicUrl = validUrl(optionalString(raw, "public_url") ?? url, `providers[${index}].public_url`)
    const name = optionalString(raw, "name") ?? id

    if (type === "jellyfin") {
        const apiKey = optionalString(raw, "api_key")
        const username = optionalString(raw, "username")
        const password = optionalString(raw, "password")
        if (!apiKey && (!username || !password)) throw new Error(`config.toml: Jellyfin provider ${id} requires api_key or username and password`)
        return { type, id, name, url, publicUrl, apiKey, username, password, icon: optionalString(raw, "icon") ?? "jellyfin" }
    }

    if (type === "navidrome") {
        return {
            type,
            id,
            name,
            url,
            publicUrl,
            username: requiredString(raw, "username", index),
            password: requiredString(raw, "password", index),
            client: optionalString(raw, "client") ?? "homelab-search",
            apiVersion: optionalString(raw, "api_version") ?? "1.16.1",
            icon: optionalString(raw, "icon") ?? "navidrome",
        }
    }

    if (type === "sonarr" || type === "radarr") {
        const common = {
            id,
            name,
            url,
            publicUrl,
            apiKey: requiredString(raw, "api_key", index),
            rootFolder: optionalString(raw, "root_folder"),
            qualityProfileId: optionalPositiveInteger(raw, "quality_profile_id", index),
            icon: optionalString(raw, "icon") ?? type,
        }
        if (type === "radarr") return { ...common, type }

        const mediaValue = raw.media ?? ["tv"]
        if (!Array.isArray(mediaValue) || mediaValue.length === 0 || mediaValue.some((item) => item !== "tv" && item !== "anime")) {
            throw new Error(`config.toml: Sonarr provider ${id} media must contain tv, anime, or both`)
        }
        return { ...common, type, media: [...new Set(mediaValue)] as ("tv" | "anime")[] }
    }

    if (type === "tidarr") {
        return {
            type,
            id,
            name,
            url,
            publicUrl,
            apiKey: requiredString(raw, "api_key", index),
            countryCode: (optionalString(raw, "country_code") ?? "US").toUpperCase(),
            icon: optionalString(raw, "icon") ?? "tidal",
        }
    }

    throw new Error(`config.toml: unsupported provider type ${type}`)
}

function optionalPositiveInteger(raw: Record<string, unknown>, key: string, index: number): number | undefined {
    const value = raw[key]
    if (value === undefined) return undefined
    if (!Number.isInteger(value) || (value as number) <= 0) throw new Error(`config.toml: providers[${index}].${key} must be a positive integer`)
    return value as number
}

function requiredString(raw: Record<string, unknown>, key: string, index: number): string {
    const value = optionalString(raw, key)
    if (!value) throw new Error(`config.toml: providers[${index}].${key} is required`)
    return value
}

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
    const value = raw[key]
    if (value === undefined) return undefined
    if (typeof value !== "string" || !value.trim()) throw new Error(`config.toml: ${key} must be a non-empty string`)
    return value.trim()
}

function validUrl(value: string, key: string): string {
    let url: URL
    try {
        url = new URL(value)
    } catch {
        throw new Error(`config.toml: ${key} must be a valid URL`)
    }
    if (![/^https?:$/].some((pattern) => pattern.test(url.protocol))) throw new Error(`config.toml: ${key} must use http or https`)
    return value.replace(/\/$/, "")
}
