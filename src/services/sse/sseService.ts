import { Response } from "express";
import AbstractService from "../../base/abstractService.js";
import { Session } from "../../database/entities/Session.entity.js";
import SSEChannel, { ChannelConfig } from "./sseChannel.js";
import Core from "../../core.js";
import FetchCache from "../../util/cache/fetchCache.js";
import SyncFetchCache from "../../util/cache/syncFetchCache.js";
import SessionManager from "../web/sessionManager.js";
import ContextService from "../context/contextService.js";
import { ComponentMethod, ComponentRenderProperties } from "../client/componentCache.js";

export default class SSEService extends AbstractService<"sse"> {

    private channels: SSEChannel[] = []
    /**
     * the find could be SLOW AS FUCK so we want to cache the result
     * there could be thousands of channels and someone could dos by spamming a channel open endpoint
     */
    private channelCache = new SyncFetchCache(id => this.channels.find(ch => ch.matches(id)))

    constructor() {
        super("sse");
    }

    public async init(): Promise<void> {
        Core.services.web.app.get("/events/:channel", async (req, res) => {
            const channel = req.params.channel

            const session = Core.services.context.get<Session>("session");
            if (!session) {
                res.status(401).end();
                return;
            }

            const check = await this.addClient(channel, session, res)

            if (!check) {
                res.status(401).send(`You are not authorized to connect to channel [${channel}]`)
                this.logger.warn(`Session(${session.id}) tried to connect to Channel(${channel}) but is not permitted to.`)
                return
            }

            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            });

            // send an initial comment to flush headers
            res.write(": connected\n\n");

            // keepalive ping every 30 seconds to prevent proxy timeouts
            const keepalive = setInterval(() => {
                res.write(": keepalive\n\n");
            }, 30000);

            res.on("close", () => {
                clearInterval(keepalive);
            });
        });

    }

    public registerChannel(config: ChannelConfig, id?: string): SSEChannel {
        const entity = new SSEChannel(config, id);
        this.channels.push(entity);
        return entity;
    }

    /**
  * Gets the first channel that matches the id string
  * you can pass extra data in the id, for the permission check
  * the result is cached
  */
    public getChannel(channel: string | SSEChannel) {
        if (channel instanceof SSEChannel) return channel;
        return this.channelCache.getOrFetch(channel)
    }

    public async addClient(channelId: string, session: Session, res: Response): Promise<boolean> {
        for (const channel of this.channels) {
            const match = channel.matches(channelId);
            if (!match) continue;

            if (channel.config.permissionCheck) {
                const allowed = await channel.config.permissionCheck(session, match.groups ?? {});
                if (!allowed) return false;
            }

            channel.addClient(channelId, session, res);

            res.on("close", () => channel.removeClient(session.id, res));
            return true;
        }
        return false;
    }

    public sendToChannel(channelId: string | SSEChannel, event: string, data: string): void {
        const channel = this.getChannel(channelId)
        if (!channel) return
        channel.send(event, data);
    }

    public sendToSession(channelId: string | SSEChannel, sessionId: string, event: string, data: string): void {
        const channel = this.getChannel(channelId)
        if (!channel) return
        channel.sendToSession(sessionId, event, data);
    }

    /**
     * broadcast an sse update to a channel, with the render method running in ALS context
     * 
     * this would work great as a news feed updater or something where you want to broadcast to a LOT of clients but need to retain session data
     * 
     * just keep in mind, this is NOT the same as the normal context used everywhere else, you can check if youre in this type of context by checking `store.method == "EVENT"` 
     * 
     * @param render MUST BE AN ASYNC FUNCTION IN ORDER TO OPEN CONTEXT OTHERWISE THIS WILL THROW
     */
    public async sendToChannelInContext(channelId: string | SSEChannel, event: string, render: () => Promise<string>) {
        const channel = this.getChannel(channelId)
        if (!channel) return

        // hehehe i love this shit
        await Promise.all(
            Object.entries(channel.clients).map(
                ([sessionChannelId, sessions]) => Promise.all(
                    sessions.map(({ sessionId, res }) => {
                        const session = SessionManager.cache.get(sessionId)
                        // this should never throw but oh my god if it does it will cause issues
                        // just return early, we cant render in session context if theres no session

                        if (!session) return

                        // open a new store! 
                        const store = Core.services.context.open()
                        store.method = "EVENT"
                        store.path = `/events/${sessionChannelId}`
                        store.res = res

                        // run in context...
                        ContextService.als.run(store, async () => {
                            const rendered = await render()
                            res.write(`event: ${event}\ndata: ${rendered}\n\n`)
                        })
                    })
                )
            )
        )
    }

    /**
     * Render a component to a channel. stupid useful. handles context for you too
     * 
     * this will use GET by default, following the normal rules
     * 
     * HOWEVER you can specify a unique render method for the component by using the EVENT method
     * @param componentId component id. follows the normal id spec
     */
    public async renderComponentToChannel(channelId: string | SSEChannel, event: string, componentId: string, props: ComponentRenderProperties = { method: "EVENT" }) {
        this.sendToChannelInContext(channelId, event, async () => Core.services.client.componentCache.render(componentId, props))
    }

    public broadcast(event: string, data: string): void {
        for (const channel of this.channels) {
            channel.send(event, data);
        }
    }

    public get connectionCount(): number {
        let count = 0;
        for (const channel of this.channels) {
            count += channel.connectionCount;
        }
        return count;
    }

}