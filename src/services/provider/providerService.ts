import AbstractService from "../../base/abstractService.js";
import AbstractProvider from "./abstractProvider.js";

export default class ProviderService extends AbstractService<"provider"> {
    constructor() {
        super("provider")
    }

    public readonly providerList: AbstractProvider<string>[] = [
    ] as const;

    public providers: {
        [K in typeof this.providerList[number]["name"]]: Extract<typeof this.providerList[number], { name: K }>
    } = {} as any

    public async init(): Promise<void> {
        for (const provider of this.providerList) {
            const providerName = provider.name
            // @ts-ignore - serviceName will always be the correct key in providers
            this.providers[providerName] = provider;

            try {
                await provider.init();
                this.logger.log(`Provider ${providerName} initialized`);
            } catch (error) {
                this.logger.error(`Error initializing service ${providerName}:`, error);
            }
        }
    }


}