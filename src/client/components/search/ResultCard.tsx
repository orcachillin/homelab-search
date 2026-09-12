import type { SearchResult, SearchResultDetail } from "../../../services/provider/searchManager.js";

export function ResultCard(result: SearchResult) {
	const meta = result.meta as { itemType?: unknown, details?: SearchResultDetail[] } | undefined;
	const itemType = typeof meta?.itemType === "string" ? meta.itemType : "Result";
	return <article class="list-group-item search-result-item text-light border-secondary d-flex align-items-center" tabindex="0">
		{result.thumbnailUrl ? <img class="result-thumbnail mr-3 rounded" src={result.thumbnailUrl} alt="" loading="lazy" /> : <div class="result-thumbnail result-thumbnail-placeholder mr-3 rounded text-muted" aria-hidden="true">{result.title.slice(0, 1).toUpperCase()}</div>}
		<div class="flex-grow-1 text-truncate">
			<div><span class="badge badge-secondary mr-2">{result.provider.icon && <img class="provider-icon provider-icon-sm mr-1" src={`/api/provider-icon?id=${encodeURIComponent(result.provider.icon)}`} alt="" />}{result.provider.displayName}</span><small class="text-muted">{itemType}</small></div>
			<h3 class="h6 mb-0 mt-1">{result.title}</h3>
			{result.description && <p class="result-summary small text-muted mb-0 text-truncate">{result.description}</p>}
			{meta?.details && meta.details.length > 0 && <dl class="result-details result-detail-grid small mb-0">
				{meta.details.map((detail) => <><dt class="text-muted">{detail.label}</dt><dd>{detail.value}</dd></>)}
			</dl>}
		</div>
		{result.actions.length > 0 && <div class="btn-group btn-group-sm ml-3" role="group">{result.actions.map((action) => action.id === "browser-download"
			? <a class={`btn btn-${action.color}`} href={`/api/media-download?${new URLSearchParams({ provider: action.provider ?? result.provider.name, id: action.resultId ?? result.id })}`} download=""><i class="bi bi-download mr-1"></i>{action.label}</a>
			: <button type="button" class={`btn btn-${action.color}`} hx-post="/api/provider-action" hx-vals={JSON.stringify({ provider: action.provider ?? result.provider.name, action: action.id, resultId: action.resultId ?? result.id })} hx-target="#action-status" hx-swap="innerHTML" hx-indicator="#search-spinner" data-download-action={action.id === "download" ? "true" : undefined}>
				{action.icon && <i class={`bi bi-${action.icon} mr-1`}></i>}{action.label}
			</button>)}</div>}
	</article>;
}
