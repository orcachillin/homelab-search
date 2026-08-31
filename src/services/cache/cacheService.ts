import { createClient } from "redis";
import AbstractService from "../../base/abstractService.js";

export default class CacheService extends AbstractService<"cache"> {

    private _client!: ReturnType<typeof createClient>;
    private _subscriber!: ReturnType<typeof createClient>;

    constructor() {
        super("cache");
    }

    public async init(): Promise<void> {
        this._client = createClient({
            url: process.env.REDIS_URL || "redis://localhost:6379"
        })

        await this._client.connect();

        this._subscriber = this._client.duplicate();
    }

    public async destroy(): Promise<void> {
        if (this._client.isOpen) {
            await this._client.quit();
        }

        if (this._subscriber.isOpen) {
            await this._subscriber.quit();
        }
    }

    public get client() {
        if (!this._client.isOpen) {
            throw new Error("Cache client is not initialized or connected");
        }
        return this._client;
    }

    public get subscriber() {
        if (!this._subscriber.isOpen) {
            throw new Error("Cache subscriber is not initialized or connected");
        }
        return this._subscriber;
    }

    public async set(key: string, value: string, ttl?: number): Promise<void> {
        this.logger.debug(`${key} -> ${value}`)
        if (ttl) {
            await this.client.setEx(key, ttl, value);
        } else {
            await this.client.set(key, value);
        }
    }

    public async get(key: string): Promise<string | null> {
        const value = await this.client.get(key);
        this.logger.debug(`? ${key} = ${value}`)
        return value
    }

    public async del(key: string): Promise<void> {
        await this.client.del(key);
    }

}
