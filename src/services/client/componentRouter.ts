import { Router } from 'express';
import Core from '../../core.js';
import { renderToStream } from '@kitajs/html/suspense';
import { OutOfBand } from '../../client/components/OutOfBand.js';

const componentRouter = Router();

componentRouter.use("/:id", async (req, res) => {
    const id = req.params.id.toLowerCase();
    const has = Core.services.client.componentCache.has(id)

    if (!has) {
        res
            .status(404)
            .setHeader("Content-Type", "text/plain")
            .send(`Component "${id}" not found`);
        return;
    }

    const query = req.query as Record<string, string>
    const rid = Core.services.context.rid

    const meta: {
        noOOB: boolean
    } = (Core.services.client.componentCache.get(id) || {}) as any

    const stream = renderToStream(async r =>
    (
        (await Core.services.client.componentCache.render(id, { ...req.body, ...query }))
        + (meta.noOOB
            ? ""
            : OutOfBand()
        )
    ), rid!)

    res.writeHead(200, {
        "Content-Type": "text/html",
        "Transfer-Encoding": "chunked"
    });

    stream.pipe(res)
});

export default componentRouter
