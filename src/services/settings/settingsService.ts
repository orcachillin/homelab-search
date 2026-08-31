import AbstractService from "../../base/abstractService.js";
import Core from "../../core.js";
import { Session } from "../../database/entities/Session.entity.js";
import SessionSetting from "../../database/entities/SessionSetting.entity.js";

export default class SettingsService extends AbstractService<"settings"> {

    public static readonly SETTING_CACHE_TTL = 3600

    constructor() {
        super("settings")
    }

    public async set(identity: Session, key: string, value: string) {
        if (!identity) return undefined

        Core.services.cache.set(`sessionSetting.${identity.id}.${key}`, value, SettingsService.SETTING_CACHE_TTL)
        return await Core.database.repository.sessionSetting.upsert(new SessionSetting(identity, key, value))


    }

    public async get(identity: Session, key: string): Promise<string | undefined> {
        if (!identity) return undefined


        const cached = await Core.services.cache.get(`sessionSetting.${identity.id}.${key}`)
        if (cached) return cached

        const db = await Core.database.repository.sessionSetting.findOne({
            id: `${identity.id}:${key}`
        })

        if (db) {
            Core.services.cache.set(`sessionSetting.${identity.id}.${key}`, db.value, SettingsService.SETTING_CACHE_TTL)
            this.logger.debug(`updated cache with ${db.id} = ${db.value}`)
            return db.value
        }


        return undefined
    }

    /**
     * using getOrSetDefault over just get can save a database request later in the future at the cost of cache storage.
     * very useful when you may be calling it every request 
     */
    public async getOrSetDefault(identity: Session, key: string, value: string): Promise<string> {
        if (!identity) return value

        const res = await this.get(identity, key)
        if (res) return res;

        this.set(identity, key, value)

        return value
    }

    // utility wrappers

    private async parseMethod<P extends (res: string) => any, G extends (...args: any[]) => Promise<string | undefined>>(parser: P, get: G, ...params: Parameters<G>): Promise<ReturnType<P> | undefined> {
        const res = await get(...params)
        return res ? parser(res) : undefined
    }

    private async parseMethodDefault<P extends (res: string) => any, G extends (...args: any[]) => Promise<string>>(parser: P, get: G, ...params: Parameters<G>): Promise<ReturnType<P>> {
        const res = await get(...params)
        return parser(res)
    }

    private getUtilMethod = <P extends (res: string) => any, G extends (...args: any[]) => Promise<string | undefined>>(parser: P, get: G): (...params: Parameters<G>) => Promise<ReturnType<P> | undefined> => (...params: Parameters<typeof get>) => this.parseMethod(parser, get, ...params)

    public getInt = this.getUtilMethod(parseInt, this.get.bind(this))
    public getFloat = this.getUtilMethod(parseFloat, this.get.bind(this))

    // sadly these have to be manually defined :(
    // makes all my type bullshit i had fun making basically useless
    public getOrSetDefaultInt = (identity: Session, key: string, value: number) => this.parseMethodDefault(parseInt, this.getOrSetDefault.bind(this), identity, key, value.toString())
    public getOrSetDefaultFloat = (identity: Session, key: string, value: number) => this.parseMethodDefault(parseFloat, this.getOrSetDefault.bind(this), identity, key, value.toString())

    /**
     * debug. dont use this in prod please :3
     */
    public async getAll(identity: Session) {
        if (!identity) return undefined

        return (await Core.database.repository.sessionSetting.find({
            id: {
                $like: `%${identity.id}:`
            }
        }))?.map(val => ({ key: val.key, value: val.value }))
    }
}