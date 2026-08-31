import { match } from "path-to-regexp";
import { Suspense } from "@kitajs/html/suspense";
import Core from "../../../core.js";
import { Component } from "../../../services/client/componentCache.js";

export function Router(props: {
	path: string;
	fallback?: string;
	catch?: string;
	default?: string | Promise<string>;
	routes: Record<string, Component>;
	params?: Record<string, any>;
	query?: Record<string, any>;
}) {
	const { path, routes, params = {}, query = {} } = props;
	const rid = Core.services.context.rid!;

	Core.services.context.setMany(params);

	const sortedRoutes = Object.entries(routes).sort(([a], [b]) => {
		// more literal chars = more specific, check first
		const aLiteral = a.replace(/:\w+/g, "").length;
		const bLiteral = b.replace(/:\w+/g, "").length;
		return bLiteral - aLiteral;
	});

	for (const [route, value] of sortedRoutes) {
		const res = match(route)(path);
		if (res) {
			const render = value.default ?? value.get;
			if (!render) continue;

			return (
				<Suspense
					rid={rid}
					fallback={props.fallback || <div>Loading...</div>}
					catch={
						props.catch ||
						((err) => (
							<div>
								Error: <br />
								{(err as any).stack as "safe"}
							</div>
						))
					}
				>
					{
						render({
							...params,
							...res.params,
							...query,
							path,
						}) as "safe"
					}
				</Suspense>
			);
		}
	}

	return props.default || "";
}
