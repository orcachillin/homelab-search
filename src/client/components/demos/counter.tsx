import Link from "../util/Link.js";

export const component = { id: "demos.counter" } as const;
export const route = "/counter";

export default function Counter({ count }: { count?: string }) {
	const current = parseInt(count || "0", 10);
	return (
		<div id="counter" class="demo">
			<h2>Counter</h2>
			<p>
				Count: <strong>{current}</strong>
			</p>
			<Link
				href="/counter"
				get="demos.counter"
				target="#counter"
				swap="morph"
				query={{ count: String(current + 1) }}
			>
				+
			</Link>
			<Link
				href="/counter"
				get="demos.counter"
				target="#counter"
				swap="morph"
				query={{ count: String(current - 1) }}
			>
				-
			</Link>
			<Link href="/counter" get="demos.counter" target="#counter" swap="morph" query={{ count: "0" }}>
				Reset
			</Link>
		</div>
	);
}
