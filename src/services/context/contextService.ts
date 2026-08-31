import { AsyncLocalStorage } from "node:async_hooks";
import { Request } from "express";
import AbstractService from "../../base/abstractService.js";
import Core from "../../core.js";
import Id from "../../util/id.js";
import ContextMiddleware from "./contextMiddleware.js";
import EmMiddleware from "./emMiddleware.js";

export default class ContextService extends AbstractService<"context"> {

    public static als = new AsyncLocalStorage<Record<string, any>>();

    constructor() {
        super("context");
    }

    public async init(): Promise<void> {
        Core.services.web.addMiddleware(EmMiddleware)
        Core.services.web.addMiddleware(ContextMiddleware)
    }

    public async destroy(): Promise<void> { }

    private get _store() {
        const als = ContextService.als.getStore()
        if (!als) throw new ContextError()

        return als
    }

    public open(): Record<string, any> {
        return { _rid: Id.get() };
    }

    public get store() {
        return this._store
    }

    public get<T = any>(key: string): T {
        return this._store[key] as T
    }

    public set(key: string, value: any): void {
        this._store[key] = value;
    }

    public setMany(values: Record<string, any>): void {
        Object.assign(this._store, values);
    }

    /** get the request id */
    public get rid(): string | undefined {
        return this.get("_rid");
    }

}

export class ContextError extends Error {
    constructor() {
        super("ContextError", {
            cause: "Tried to open the context outside of an async request context"
        })
    }
}