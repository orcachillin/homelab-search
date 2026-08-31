import { performance } from "node:perf_hooks";
import Core from "../../core.js";
import Cache, { CacheLimitType } from "../../util/cache/cache.js";
import { CacheOptions } from "../../util/cache/fetchCache.js";
import { Logger } from "../../util/logger.js";
import { componentLoaders } from "./generated/componentManifest.js";

export type ComponentMethod = (props: Record<string, any>) => any

export type ComponentRegistration = {
    id: string
    aliases?: readonly string[]
}

export type Component = {
    component: ComponentRegistration
    default?: ComponentMethod
    get?: ComponentMethod
    post?: ComponentMethod
    put?: ComponentMethod
    delete?: ComponentMethod
    event?: ComponentMethod
    route?: string | readonly string[]
    skipRouter?: true
    skipDefault?: true
    noCache?: true
    noOOB?: true
    id: string
    path: string
    srcPath: string
    _isRel: boolean
    [key: string]: any
}

type ComponentModule = Omit<Component, "id" | "path" | "srcPath" | "_isRel">

/**
 * Properties required to call the Render method
 */
export type ComponentRenderProperties = Parameters<ComponentMethod>[0] & { cacheId?: string, method?: string, cacheKey?: string }


export default class ComponentCache extends Map<string, Component> {

    private readonly logger = new Logger("ComponentCache")
    private readonly routeSources = new Map<string, string>()
    public readonly renderCache: Cache<string, string>
    public readonly routes: Record<string, Component> = {}

    constructor(cacheOptions: CacheOptions = {
        limitBy: CacheLimitType.Time,
        staleDataThreshold: 3
    }) {
        super();
        this.renderCache = new Cache<string, string>(cacheOptions)
    }

    private validateId(id: string, source: string): string {
        if (id !== id.toLowerCase() || !/^[a-z0-9_.-]+$/.test(id)) {
            throw new Error(`Invalid component ID "${id}" in ${source}; IDs must be lowercase and URL-safe.`)
        }

        return id
    }

    private registerId(id: string, component: Component, source: string, isAlias = false): void {
        const validatedId = this.validateId(id, source)
        const existing = this.get(validatedId)
        if (existing) {
            throw new Error(`Duplicate component ID "${validatedId}": ${existing.path} and ${source}`)
        }

        this.set(validatedId, isAlias ? { ...component, _isRel: true } : component)
    }

    private registerRoute(route: string, component: Component, source: string): void {
        const existingSource = this.routeSources.get(route)
        if (existingSource) {
            throw new Error(`Duplicate route "${route}": ${existingSource} and ${source}`)
        }

        this.routeSources.set(route, source)

        if (component.skipRouter) {
            Core.services.web.addRoute(route, async (req, res, next) => {
                const method = req.method.toLowerCase()
                const methodId = Object.hasOwn(component, method)
                    ? method
                    : component.skipDefault
                        ? undefined
                        : "default"
                const handler = methodId && component[methodId]

                if (typeof handler !== "function") {
                    next()
                    return
                }

                res.send(await handler({
                    ...req.body,
                    ...req.query,
                    ...req.params,
                    path: req.path
                }))
            })
            return
        }

        this.routes[route] = component
    }

    private registerComponent(module: ComponentModule, source: string): void {
        const registration = module.component
        if (!registration?.id) {
            throw new Error(`Component ${source} does not export a valid component registration.`)
        }

        const component = {
            ...module,
            get: module.get ?? module.default,
            id: registration.id,
            path: source,
            srcPath: `src/client/components/${source}`,
            _isRel: false
        } as Component

        if (!component.get && !component.post && !component.put && !component.delete && !component.event) {
            throw new Error(`Component ${source} does not export a request handler.`)
        }

        this.registerId(registration.id, component, source)
        for (const alias of registration.aliases ?? []) {
            this.registerId(alias, component, source, true)
        }

        const routes = module.route
            ? typeof module.route === "string"
                ? [module.route]
                : module.route
            : []

        for (const route of routes) this.registerRoute(route, component, source)

        this.logger.debug(`Loaded component: ${registration.id} from ${source}`)
    }

    public async init(): Promise<void> {
        for (const entry of componentLoaders) {
            try {
                const module = await entry.load() as unknown as ComponentModule
                this.registerComponent(module, entry.source)
            } catch (error) {
                throw new Error(`Failed to load component ${entry.source}`, { cause: error })
            }
        }

        this.logger.log(`Initialized ${componentLoaders.length} client components`)
    }

    public getComponentMethod(key: string): ComponentMethod | undefined {
        const component = super.get(key)
        return component?.default ?? component?.get
    }

    public async render(id: string, props: ComponentRenderProperties): Promise<string> {
        const startedAt = Core.DEVELOPMENT ? performance.now() : 0
        const component = this.get(id)
        const reqMethod = Core.services.context.get<string>("method")?.toLowerCase() || props.method?.toLowerCase() || "default"
        const renderMethod = component?.[reqMethod]

        try {
            if (!component || !renderMethod) return ""

            if (component.noCache || !props.cacheId) {
                return await renderMethod(props)
            }

            const cacheKey = `${id} - ${reqMethod} - ${props.cacheId}`
            const cachedRender = this.renderCache.get(cacheKey)

            if (cachedRender) {
                this.logger.debug(`[CACHED] render: ${id}`)
                return cachedRender
            }

            props.cacheKey = cacheKey
            const res = await renderMethod(props)

            this.renderCache.set(cacheKey, res)
            return res
        } finally {
            if (Core.DEVELOPMENT) {
                this.logger.log(`${id} ${reqMethod} render: ${(performance.now() - startedAt).toFixed(3)}ms`)
            }
        }
    }

}
