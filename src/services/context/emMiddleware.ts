import { NextFunction, Request, Response } from "express";
import Core from "../../core.js";
import Database from "../../database/index.js";

/**
 * Forks the EntityManager per HTTP request, stores it in ALS so
 * `Core.database.em` returns the request-scoped fork, and flushes
 * automatically when the response finishes.
 */
export default function EmMiddleware(req: Request, res: Response, next: NextFunction) {
    const em = Core.database.orm.em.fork();

    Database.requestEm.run(em, () => {
        res.on("finish", async () => {
            try {
                await em.flush();
            } catch (err) {
                console.error("EmMiddleware: flush failed", err);
            }
        });

        next();
    });
}
