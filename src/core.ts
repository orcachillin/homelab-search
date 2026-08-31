import Database from "./database/index.js";
import CacheService from "./services/cache/cacheService.js";
import ClientService from "./services/client/clientService.js";
import ContextService from "./services/context/contextService.js";
import SettingsService from "./services/settings/settingsService.js";
import SSEService from "./services/sse/sseService.js";
import WebService from "./services/web/webService.js";
import { Logger } from "./util/logger.js";

export default class Core {

    protected static logger = new Logger("Core");
    public static database: Database = new Database();
    public static BASE_URL: string = process.env.BASE_URL || "http://localhost:3000";
    public static readonly DEVELOPMENT = process.env.NODE_ENV === "development" || !process.argv.includes("--prod")

    /**
     * A set of all services that are initialized by the core.
     * 
     * services are started synchronously in this order.
     */
    public static readonly serviceList = [
        new CacheService(),
        new SettingsService(),
        new WebService(),
        new ContextService(),
        new SSEService(),
        new ClientService(), // make sure it registers its wildcard route last
    ] as const;

    public static services: {
        [K in typeof this.serviceList[number]["name"]]: Extract<typeof this.serviceList[number], { name: K }>
    } = {} as any;

    public static async init() {

        if (this.DEVELOPMENT) {
            this.logger.warn("Development mode enabled.")
        }

        await this.database.init();

        for (const service of this.serviceList) {
            const serviceName = service.name
            // @ts-ignore - serviceName will always be the correct key in services
            this.services[serviceName] = service;

            try {
                await service.init();
                this.logger.log(`Service ${serviceName} initialized`);
            } catch (error) {
                this.logger.error(`Error initializing service ${serviceName}:`, error);
            }
        }

        this.logger.log("All services initialized, starting web service...");

        await this.database.em.flush();
        await this.services.web.start();

        this.logger.log("Ready!")
    }

    public static async destroy() {
        for (const service of Object.values(this.services)) {
            try {
                await service.destroy();
            } catch (error) {
                this.logger.error(`Error destroying service ${service.name}:`, error);
            }
        }
    }
}
