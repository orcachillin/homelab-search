import { Children } from "@kitajs/html";
import Core from "../../../core.js";
import { Session } from "../../../database/entities/Session.entity.js";

function recordToQueryString(rec: Record<string, string | undefined>) {
	return `?${Object.entries(rec)
		.filter(([_, v]) => ["string", "number"].includes(typeof v))
		.map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
		.join("&")}`;
}

export default function Link(props: {
	children: Children;
	href: string;
	class?: string;
	id?: string;
	get?: string;
	target?: string;
	swap?: string;
	url?: string;
	query?: Record<string, number | string | undefined>;
	cacheId?: string;
	preload?: boolean | string;
}) {
	const session = Core.services.context.get<Session>("session");

	return (
		<a
			id={props.id}
			class={props.class}
			href={props.href}
			preload={props.preload}
			hx-get={
				props.get &&
				`/-/${props.get}${recordToQueryString({
					...props.query,
					cacheId: session && props.cacheId && session.id + props.cacheId,
					path: props.url || props.href,
				})}`
			}
			hx-swap={props.swap || "transition:true"}
			hx-target={props.target || "#main"}
			hx-push-url={props.url || props.href}
		>
			{props.children}
		</a>
	);
}
