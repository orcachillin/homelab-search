import { Children } from "@kitajs/html";
import Link from "../util/Link.js";

export function MainLayout(props: { children: Children }) {
	return (
		<div class="layout">
			<nav class="navbar">
				<a href="/" class="navbar-brand">
					nitr
				</a>
				<div class="navbar-links">
					<Link href="/counter" get="demos.counter">Counter</Link>
					<Link href="/sse" get="demos.time">SSE</Link>
				</div>
				<div class="navbar-links navbar-right">
					<a href="https://github.com/orcachillin/nitr">Github</a>
				</div>
			</nav>
			<main id="main" class="container" hx-history-elt>
				{props.children}
			</main>
		</div>
	);
}