import Core from "../../core.js";
import { Session } from "../../database/entities/Session.entity.js";
import { Logger } from "../../util/logger.js";
import { ms } from "../../util/time.js";

const sessionExpire = ms("1 week")
const sessionTouch = ms("5 minutes")

export default class SessionManager {

    public static readonly logger = new Logger("SessionManager")
    public static cache: Map<string, Session> = new Map();
    public static ignoreCache: Set<string> = new Set();
    public static touchCache: Map<string, NodeJS.Timeout> = new Map();

    public static async genSession(userAgent: string): Promise<Session> {
        const session = new Session();
        session.userAgent = userAgent;

        await Core.database.em.persist(session).flush();
        this.cache.set(session.id, session);

        return session;
    }

    public static async checkSession(session: string, userAgent?: string): Promise<Session | undefined> {

        if (!userAgent) {
            this.logger.warn("incoming request has no user agent... maybe the proxy is set up incorrectly?")
        }

        if (this.ignoreCache.has(session)) {
            return undefined;
        }

        // check if session is in cache
        if (this.cache.has(session)) {
            const cachedSession = this.cache.get(session)!;

            if (userAgent && cachedSession.userAgent !== userAgent) {
                this.ignoreCache.add(session);
                return undefined;
            }

            this.touchSession(cachedSession);
            return cachedSession;
        }

        // check if session exists
        const validSession = await Core.database.em.findOne(Session, {
            id: session,
        }, {
            populate: [],
        });

        if (validSession) {

            // Add to cache
            this.cache.set(validSession.id, validSession);

            if (userAgent && validSession.userAgent !== userAgent) {
                this.ignoreCache.add(session);
                return undefined;
            }

            // Update the session
            validSession.lastUsed = new Date();

            // no need to await
            Core.database.em.persist(validSession).flush();
            return validSession;
        } else {
            return this.genSession(userAgent || "unknown")
        }
    }

    public static async deleteSession(session: string): Promise<void> {
        const sessionEntity = await Core.database.em.findOne(Session, {
            id: session,
        });

        if (sessionEntity) {
            await Core.database.em.remove(sessionEntity).flush();
        }

        this.cache.delete(session);
    }

    public static async touchSession(session: Session): Promise<void> {
        session.lastUsed = new Date();
        this.cache.set(session.id, session);

        if (this.touchCache.has(session.id)) {
            clearTimeout(this.touchCache.get(session.id)!);
        }

        this.touchCache.set(session.id, setTimeout(async () => {
            this.touchCache.delete(session.id);
            await Core.database.em.remove(session).flush();
        }, sessionTouch));
    }

    public static async checkSessionExpire(): Promise<void> {
        if (!Core.database.em) return;
        const sessions = await Core.database.em.find(Session, {
            lastUsed: {
                $lt: new Date(Date.now() - sessionExpire),
            },
        })

        await Core.database.em.remove(sessions).flush();
    }
}