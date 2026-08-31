import Core from "../../core.js";
import Head from "./Head.js";
import { MainLayout } from "./layouts/MainLayout.js";
import { Router } from "./util/Router.js";

export default async function Index() {
	const context = Core.services.context.store;
	return (
		<>
			{"<!DOCTYPE html>"}
			<html data-bs-theme="dark">
				<Head />
				<body hx-ext="preload, sse">
					<MainLayout>
						<Router
							path={context.path}
							query={context.query}
							routes={Core.services.client.componentCache.routes}
							default={`Page 	not found: ${context.path}`}
						/>
					</MainLayout>
				</body>
			</html>
		</>
	);
}
