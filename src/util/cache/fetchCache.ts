import Cache, { CacheLimitType } from "./cache.js";

type nullish = null | undefined;
export interface CacheOptions {
    prune?: boolean;
    limitFactor?: number;
    limitBy?: CacheLimitType;
    staleDataThreshold?: number;
}

export default class FetchCache<CachedType, CacheKey = string> extends Cache<CachedType, CacheKey> {
    private _fetchMethod: (key: CacheKey) => Promise<CachedType | nullish> | CachedType | nullish;

    constructor(
        fetchMethod: (key: CacheKey) => Promise<CachedType | nullish> | CachedType | nullish,
        options?: CacheOptions
    ) {
        super(options);
        this._fetchMethod = fetchMethod;
    }

    public async getOrFetch(key: CacheKey): Promise<CachedType | undefined> {
        const value = this.get(key);
        if (value) {
            return value;
        }
        return this.forceGet(key);
    }

    public async forceGet(key: CacheKey): Promise<CachedType | undefined> {
        const value = await this._fetchMethod(key);
        if (value) {
            this.set(key, value);
        } else {
            this.delete(key);
        }
        return value || undefined;
    }
}