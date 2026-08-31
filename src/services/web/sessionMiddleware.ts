import { NextFunction, Request, Response } from "express";
import SessionManager from "./sessionManager.js";
import { ms } from "../../util/time.js";

export default async function SessionMiddleware(req: Request, res: Response, next: NextFunction) {
    const session = await SessionManager.checkSession(req.cookies.session, req.headers["user-agent"])

    if (session && session.id != req.cookies.session) {
        res.cookie("session", session.id, { maxAge: ms("7 days"), httpOnly: true })
    }

    req.body = {
        ...req.body,
        session // should overwrite setting "session" in the body of a POST request
    }

    next()
}