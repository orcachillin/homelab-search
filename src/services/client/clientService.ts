import AbstractService from "../../base/abstractService.js";
import Core from "../../core.js";
import componentRouter from "./componentRouter.js";
import ComponentCache from "./componentCache.js";
import { renderToStream } from "@kitajs/html/suspense";
import Index from "../../client/components/index.js";

export default class ClientService extends AbstractService<"client"> {

    public componentCache: ComponentCache;

    constructor() {
        super("client")
        this.componentCache = new ComponentCache();
    }

    public async init(): Promise<void> {
        await this.componentCache.init();

        Core.services.web.addRoute("/-", componentRouter)

        Core.services.web.app.get("*root", (req, res) => {
            const rid = Core.services.context.rid!

            const stream = renderToStream(async r =>
                await Index(), rid)
            res.setHeader("Content-Type", "text/html; charset=utf-8")

            stream.pipe(res)
        })
    }
}
