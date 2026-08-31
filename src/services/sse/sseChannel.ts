import { Response } from "express";
import { Session } from "../../database/entities/Session.entity.js";
import SSEService from "./sseService.js";
import Core from "../../core.js";

export type ChannelConfig = {
    pattern: RegExp;
    permissionCheck?: (session: Session, args: Record<string, string>) => Promise<boolean>
}

type SSEClient = {
    sessionId: string;
    res: Response;
};

export default class SSEChannel {
    public readonly id: string;
    public readonly config: ChannelConfig;
    /**
     * maybe dont fuck with this unless you need to loop over it or something
     * 
     * idk. i use it internally, see {@link SSEService.sendToChannelInContext}
     */
    public readonly clients: Record<string, SSEClient[]> = {};

    constructor(config: ChannelConfig, id?: string) {
        this.config = config;
        this.id = id ?? config.pattern.source;
    }

    matches(channelId: string): RegExpMatchArray | null {
        return channelId.match(this.config.pattern);
    }

    addClient(channelId: string, session: Session, res: Response): boolean {
        const match = this.matches(channelId);
        if (!match) return false;
        const sessionId = session.id;
        const existing = this.clients[sessionId] || [];
        existing.push({ sessionId, res });
        this.clients[sessionId] = existing;
        return true;
    }

    removeClient(sessionId: string, res: Response): void {
        const existing = this.clients[sessionId]?.filter(c => c.res !== res);
        if (existing && existing.length > 0) {
            this.clients[sessionId] = existing;
        } else {
            delete this.clients[sessionId];
        }
    }

    send(event: string, data: string | Element): void {
        for (const clients of Object.values(this.clients)) {
            for (const client of clients) {
                client.res.write(`event: ${event}\ndata: ${data}\n\n`);
            }
        }
    }

    sendToSession(sessionId: string, event: string, data: string | Element): void {
        const clients = this.clients[sessionId];
        if (!clients) return;
        for (const client of clients) {
            client.res.write(`event: ${event}\ndata: ${data}\n\n`);
        }
    }

    sendToChannelInContext(...params: RemoveFirst<Parameters<SSEService["sendToChannelInContext"]>>) {
        Core.services.sse.sendToChannelInContext(this, ...params)
    }

    renderComponentToChannel(...params: RemoveFirst<Parameters<SSEService["renderComponentToChannel"]>>) {
        Core.services.sse.renderComponentToChannel(this, ...params)
    }

    get connectionCount(): number {
        let count = 0;
        for (const clients of Object.values(this.clients)) {
            count += clients.length;
        }
        return count;
    }
}

type RemoveFirst<T extends any[]> = T extends [any, ...infer Rest] ? Rest : never;