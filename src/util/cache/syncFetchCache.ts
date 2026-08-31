import Cache, { CacheLimitType } from "./cache.js";

type nullish = null | undefined;
export interface CacheOptions {
    prune?: boolean;
    limitFactor?: number;
    limitBy?: CacheLimitType;
    staleDataThreshold?: number;
}

/**
 * Functionally the same as {@link FetchCache} but without promise and async so you can run it sync
 * 
 * maybe this saves cycles??? idk
 * 
 * the entire point of caching shit is to run on slow methods
 * 
 * maybe your slow method is sync??? that sounds like a you problem
 */
export default class SyncFetchCache<CachedType, CacheKey = string> extends Cache<CachedType, CacheKey> {
    private _fetchMethod: (key: CacheKey) => CachedType | nullish;

    constructor(
        fetchMethod: (key: CacheKey) => CachedType | nullish,
        options?: CacheOptions
    ) {
        super(options);
        this._fetchMethod = fetchMethod;
    }

    public getOrFetch(key: CacheKey): CachedType | undefined {
        const value = this.get(key);
        if (value) {
            return value;
        }
        return this.forceGet(key);
    }

    public forceGet(key: CacheKey): CachedType | undefined {
        const value = this._fetchMethod(key);
        if (value) {
            this.set(key, value);
        } else {
            this.delete(key);
        }
        return value || undefined;
    }
}