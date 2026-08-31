import { MikroORM, PostgreSqlDriver, EntityManager } from "@mikro-orm/postgresql";
import Logger from "../util/logger.js";
import { EntityRepository } from "@mikro-orm/core";
import { AsyncLocalStorage } from "node:async_hooks";
import { Session } from "./entities/Session.entity.js";
import SessionSetting from "./entities/SessionSetting.entity.js";
import { DatabaseConfig } from "./config.js";

let instance: Database;

export default class Database {

    private _orm!: MikroORM;
    private _em!: EntityManager<PostgreSqlDriver>;

    /** request-scoped EM — set by EmMiddleware per HTTP request */
    public static requestEm = new AsyncLocalStorage<EntityManager<PostgreSqlDriver>>();

    public repository!: {
        session: EntityRepository<Session>
        sessionSetting: EntityRepository<SessionSetting>
    }

    constructor() {
        if (instance) {
            return instance;
        }
        instance = this;
    }

    public async init(): Promise<void> {
        const _orm = await MikroORM.init<PostgreSqlDriver>(DatabaseConfig as Parameters<typeof MikroORM.init<PostgreSqlDriver>>[0]).catch((err) => {
            Logger.error("Database", "Failed to initialize database");
            Logger.error("Database", err);
            console.error(err);
            process.exit(1);
        });

        this._orm = _orm;
        this._em = _orm.em.fork() // dont use the root em for anything

        this.repository = {
            session: this.em.getRepository(Session),
            sessionSetting: this.em.getRepository(SessionSetting),
        }

        Logger.info("Database", "Database initialized");

    }

    public async close(): Promise<void> {
        await this._orm.close(true);
    }

    public get em(): EntityManager<PostgreSqlDriver> {
        if (!this._em) {
            throw new Error("Database not initialized");
        }
        return Database.requestEm.getStore() || this._em;
    }

    public get orm(): MikroORM {
        return this._orm;
    }
}