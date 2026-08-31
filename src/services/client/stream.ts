import { renderToStream } from "@kitajs/html/suspense";
import Core from "../../core.js";
import { Response } from "express";

export default async function stream(res: Response, component: JSX.Element) {
	const rid = Core.services.context.rid!;
	const st = renderToStream(component, rid)

	res.writeHead(200, {
		"Content-Type": "text/html",
		"Transfer-Encoding": "chunked",
	});

	if (st && typeof st.on === "function") {
		st.on("data", (chunk: any) => res.write(chunk));
		st.once("error", (err: any) => {
			res.write("Error: " + err.message)
			res.end();
		})
		st.once("end", () => res.end());
	} else {
		res.end("Stream error");
	}
}
