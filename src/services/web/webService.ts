import express, { Application, RequestHandler } from "express";
import AbstractService from "../../base/abstractService.js";
import { Server } from "http";
import cookieParser from "cookie-parser";
import { resolve } from "path";
import SessionMiddleware from "./sessionMiddleware.js";

export default class WebService extends AbstractService<"web"> {

    public app: Application;
    public server: Server;
    public port: number = parseInt(process.env.PORT!) || 3000

    constructor() {
        super("web");
        this.app = express();
        this.server = new Server(this.app);
    }

    public async init(): Promise<void> {
        this.app.use(cookieParser())
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        this.app.use("/_", express.static(resolve("./src/static/")))
        this.app.use("/__", express.static(resolve("./dist/client")))

        this.addMiddleware(SessionMiddleware)
    }

    public async start(): Promise<void> {
        this.port = await this._attemptStart(this.port)
    }

    private _attemptStart(port: number, iter: number = 0) {
        return new Promise<number>((resolve, reject) => {
            if (iter > 9) {
                this.logger.error("Error starting service: failed after", iter, "attempts");
                reject()
            }

            const attempt = new Promise<void>((ars, arj) => {
                this.server.listen(port, () => {
                    this.logger.log(`Started on port ${port}`);
                    ars();
                }).on("error", (err) => {
                    this.logger.warn(`Error starting on ${port}, making another attempt...`);
                    arj(err);
                });
            });

            attempt
                .catch(() => this._attemptStart(++port, ++iter))
                .finally(() => resolve(port))
        })

    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server.close((err) => {
                if (err) {
                    return reject(err);
                }
                this.logger.log("Service stopped");
                resolve();
            });
        });
    }

    public addRoute(path: string, handler: RequestHandler): void {
        this.app.use(path, handler);
    }

    public addMiddleware(handler: RequestHandler): void {
        this.app.use(handler)
    }

}