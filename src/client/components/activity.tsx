import Core from "../../core.js";
import type { ProviderActivity } from "../../services/provider/abstractProvider.js";
import type { Session } from "../../database/entities/Session.entity.js";

export const component = { id: "provider.activity" } as const;
export const noCache = true;

export async function get({ all }: { all?: string } = {}) {
	const session = Core.services.context.get<Session>("session");
	const showAll = all === "true";
	const tracked = session ? Core.services.provider.sessionActivity.get(session.id) : undefined;
	const settled = await Promise.allSettled([...Core.services.provider.providers.values()].map(async (provider) => ({
		provider,
		activity: (await provider.getActivity()).filter((item) => showAll || item.trackingIds.some((id) => isTracked(tracked?.get(provider.name), id))),
	})));
	const groups = settled.flatMap((result) => result.status === "fulfilled" && result.value.activity.length > 0 ? [result.value] : []);

	return (
		<aside
			id="provider-activity"
			class="activity-sidebar"
			data-open="false"
		>
			<button type="button" class="btn btn-secondary activity-toggle" data-activity-toggle title="Activity"><i class="bi bi-list-task"></i></button>
			<div
				id="provider-activity-content"
				class="card bg-dark border-secondary activity-panel"
				data-show-all={String(showAll)}
				hx-get={`/-/provider.activity?all=${showAll}`}
				hx-trigger="load delay:2s, every 2s, providerActivityRefresh from:body"
				hx-target="this"
				hx-select="#provider-activity-content"
				hx-swap="outerHTML show:none"
			>
				<div class="card-header py-2 d-flex align-items-center justify-content-between">
					<strong>Activity <span class="badge badge-secondary">{groups.reduce((count, group) => count + group.activity.length, 0)}</span></strong>
					<div>
						<button type="button" class="btn btn-sm btn-outline-light mr-2" data-activity-all hx-get={`/-/provider.activity?all=${!showAll}`} hx-target="#provider-activity-content" hx-select="#provider-activity-content" hx-swap="outerHTML show:none">{showAll ? "This session" : "Show all"}</button>
						<button type="button" class="btn btn-sm btn-outline-light" data-activity-close aria-label="Close activity"><i class="bi bi-x-lg"></i></button>
					</div>
				</div>
				<div class="list-group list-group-flush">
					{groups.length === 0
						? <div class="list-group-item search-result-item text-muted">No {showAll ? "provider" : "session"} activity.</div>
						: groups.flatMap(({ provider, activity }) => activity.map((item) => ActivityRow(provider.displayName, provider.icon, item)))}
				</div>
			</div>
		</aside>
	);
}

function isTracked(tracked: Set<string> | undefined, id: string): boolean {
	if (!tracked) return false;
	return tracked.has(id) || [...tracked].some((value) => value.endsWith("*") && id.startsWith(value.slice(0, -1)));
}

function ActivityRow(providerName: string, icon: string | undefined, item: ProviderActivity) {
	const color = item.status === "attention" ? "danger" : item.status === "paused" ? "warning" : "primary";
	return <div class="list-group-item search-result-item text-light border-secondary py-2">
		<div class="d-flex align-items-center">
			{icon && <img class="provider-icon mr-2" src={`/api/provider-icon?id=${encodeURIComponent(icon)}`} alt="" />}
			<div class="flex-grow-1 text-truncate">
				<div class="small"><strong>{providerName}</strong> · {item.title}</div>
				<div class="small text-muted text-truncate">{item.detail}</div>
			</div>
			<span class={`badge badge-${color} ml-2 text-capitalize`}>{item.status}</span>
		</div>
		{item.progress === undefined
			? item.status === "active" && <div class="progress mt-2"><div class={`progress-bar progress-bar-striped progress-bar-animated bg-${color} w-100`}></div></div>
			: <div class="progress mt-2"><div class={`progress-bar bg-${color}`} style={`width:${item.progress.toFixed(1)}%`}>{item.progress.toFixed(0)}%</div></div>}
	</div>;
}
