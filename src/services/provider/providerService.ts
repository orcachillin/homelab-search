import AbstractService from "../../base/abstractService.js";
import AbstractProvider from "./abstractProvider.js";
import JellyfinProvider from "./impl/jellyfinProvider.js";
import NavidromeProvider from "./impl/navidromeProvider.js";
import SearchManager from "./searchManager.js";
import Core from "../../core.js";
import { SearchResultActionResolutionType } from "./searchManager.js";
import { loadProviderConfig } from "../../config/providerConfig.js";
import ArrProvider from "./impl/arrProvider.js";
import TidarrProvider from "./impl/tidarrProvider.js";
import * as simpleIcons from "simple-icons";
import type { SimpleIcon } from "simple-icons";
import { Readable } from "node:stream";

export default class ProviderService extends AbstractService<"provider"> {
    constructor() {
        super("provider")
    }

    public readonly providerList: AbstractProvider<string>[] = []

    public readonly providers = new Map<string, AbstractProvider<string>>()
    public readonly search = new SearchManager(() => [...this.providers.values()])
    public readonly sessionActivity = new Map<string, Map<string, Set<string>>>()

    public async init(): Promise<void> {
        const configs = await loadProviderConfig()
        this.providerList.push(...configs.map((config) => {
            if (config.type === "jellyfin") return new JellyfinProvider(config)
            if (config.type === "navidrome") return new NavidromeProvider(config)
            if (config.type === "tidarr") return new TidarrProvider(config)
            return new ArrProvider(config)
        }))

        for (const provider of this.providerList) {
            const providerName = provider.name
            try {
                await provider.init();
                this.providers.set(providerName, provider)
                this.logger.log(`Provider ${providerName} initialized`);
            } catch (error) {
                this.logger.warn(`Provider ${providerName} unavailable:`, error);
            }
        }

        Core.services.web.addRoute("/api/thumbnail", async (req, res) => {
            const providerName = typeof req.query.provider === "string" ? req.query.provider : ""
            const id = typeof req.query.id === "string" ? req.query.id : ""
            const provider = this.providers.get(providerName)
            if (!provider || !id || id.length > 512) {
                res.sendStatus(404)
                return
            }

            try {
                const thumbnail = await provider.getThumbnail(id)
                res
                    .status(200)
                    .setHeader("Content-Type", thumbnail.contentType)
                    .setHeader("Cache-Control", "private, max-age=86400")
                    .send(Buffer.from(thumbnail.data))
            } catch (error) {
                this.logger.warn(`Thumbnail request failed for provider ${providerName}:`, error)
                res.sendStatus(404)
            }
        })

        Core.services.web.addRoute("/api/provider-icon", async (req, res) => {
            const slug = typeof req.query.id === "string" ? req.query.id.toLowerCase() : ""
            const icon = providerIcons.get(slug)
            if (!icon) {
                res.sendStatus(404)
                return
            }
            res
                .setHeader("Content-Type", "image/svg+xml")
                .setHeader("Cache-Control", "public, max-age=604800")
                .send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="${icon}"/></svg>`)
        })

        Core.services.web.addRoute("/api/media-download", async (req, res) => {
            const providerName = typeof req.query.provider === "string" ? req.query.provider : ""
            const id = typeof req.query.id === "string" ? req.query.id : ""
            const provider = this.providers.get(providerName)
            if (!provider || !id || id.length > 512) {
                res.sendStatus(404)
                return
            }

            try {
                const download = await provider.getDownload(id, req.get("Range"))
                const upstream = download.response
                if (!upstream.ok && upstream.status !== 206) {
                    res.sendStatus(upstream.status === 404 ? 404 : 502)
                    return
                }
                res.status(upstream.status)
                for (const header of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
                    const value = upstream.headers.get(header)
                    if (value) res.setHeader(header, value)
                }
                const disposition = upstream.headers.get("content-disposition")
                if (disposition) res.setHeader("Content-Disposition", sanitizeDisposition(disposition))
                else res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(download.filename ?? "download")}"`)
                res.setHeader("Cache-Control", "private, no-store")
                res.setHeader("X-Content-Type-Options", "nosniff")
                if (!upstream.body) {
                    res.end()
                    return
                }
                Readable.fromWeb(upstream.body as import("node:stream/web").ReadableStream).pipe(res)
            } catch (error) {
                this.logger.warn(`Download request failed for provider ${providerName}:`, error)
                if (!res.headersSent) res.sendStatus(502)
                else res.destroy()
            }
        })

        Core.services.web.addRoute("/api/provider-action", async (req, res) => {
            const providerName = String(req.body.provider ?? req.query.provider ?? "")
            const actionId = String(req.body.action ?? req.query.action ?? "")
            const resultId = String(req.body.resultId ?? req.query.resultId ?? "")
            const provider = this.providers.get(providerName)
            if (!provider || !actionId || !resultId || resultId.length > 512) {
                res.status(404).send("Action not found")
                return
            }

            try {
                const resolution = await provider.invokeHandler(actionId, resultId)
                const session = Core.services.context.get<{ id: string }>("session")
                const trackingIds = [resolution.activityTrackingId, ...(resolution.activityTrackingIds ?? [])].filter((id): id is string => Boolean(id))
                if (session && trackingIds.length > 0) {
                    const providers = this.sessionActivity.get(session.id) ?? new Map<string, Set<string>>()
                    const ids = providers.get(providerName) ?? new Set<string>()
                    trackingIds.forEach((id) => ids.add(id))
                    providers.set(providerName, ids)
                    this.sessionActivity.set(session.id, providers)
                }
                res.setHeader("HX-Trigger", "providerActivityRefresh")
                if (resolution.type === SearchResultActionResolutionType.OpenUrl) {
                    if (req.get("HX-Request") === "true") {
                        res.setHeader("HX-Redirect", resolution.url).send("")
                    } else {
                        res.redirect(303, resolution.url)
                    }
                    return
                }

                res
                    .status(resolution.success ? 200 : 400)
                    .send(`<div class="alert alert-${resolution.color}" role="alert">${escapeHtml(resolution.message)}</div>`)
            } catch (error) {
                this.logger.warn(`Provider action ${providerName}/${actionId} failed:`, error)
                res.status(500).send(`<div class="alert alert-danger" role="alert">${escapeHtml(error instanceof Error ? error.message : "Action failed")}</div>`)
            }
        })

    }


}

const providerIcons = new Map(
    Object.values(simpleIcons)
        .filter((icon): icon is SimpleIcon => typeof icon === "object" && icon !== null && "slug" in icon && "path" in icon)
        .map((icon) => [icon.slug, icon.path])
)

function escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
    })[character]!)
}

function sanitizeFilename(value: string): string {
    return value.replace(/[\\/:*?"<>|\r\n\x00-\x1f]/g, "_").slice(0, 200) || "download"
}

function sanitizeDisposition(value: string): string {
    const filename = /filename\*?=(?:UTF-8''|"?)([^";]+)/i.exec(value)?.[1]
    return `attachment; filename="${sanitizeFilename(filename ? decodeURIComponent(filename) : "download")}"`
}
