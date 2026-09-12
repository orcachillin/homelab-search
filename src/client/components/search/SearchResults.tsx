import Core from "../../../core.js";
import { AutodetectedSearchType } from "../../../services/provider/searchManager.js";
import { parseSearchSyntax } from "../../../services/provider/searchSyntax.js";
import { ResultCard } from "./ResultCard.js";
import { isMediaSource, isMediaType, isResultType, values, type SearchProps } from "./searchOptions.js";

export async function SearchResults(props: SearchProps) {
	const query = props.query?.trim();
	if (!query) return <div id="search-results" class="text-center text-muted py-5"></div>;

	try {
		const syntax = parseSearchSyntax(query, [...Core.services.provider.providers.keys()]);
		if (!syntax.query)
			return (
				<div id="search-results" class="alert alert-secondary mt-4">
					Add some search text after the filters.
				</div>
			);
		const search = await Core.services.provider.search.search({
			type: AutodetectedSearchType.Text,
			query: syntax.query,
			providers: new Set(syntax.providers.length > 0 ? syntax.providers : values(props.providers)),
			mediaTypes: new Set(
				syntax.mediaTypes.length > 0
					? syntax.mediaTypes
					: values(props.mediaTypes).map(Number).filter(isMediaType),
			),
			sources: new Set(
				syntax.sources.length > 0 ? syntax.sources : values(props.sources).map(Number).filter(isMediaSource),
			),
			resultTypes: new Set(
				syntax.resultTypes.length > 0 ? syntax.resultTypes : values(props.resultTypes).filter(isResultType),
			),
			limit: syntax.limit ?? Number.parseInt(props.limit ?? "20", 10),
		});

		return (
			<div id="search-results" class="mt-4" aria-live="polite">
				<div class="d-flex justify-content-between align-items-center mb-2 text-muted">
					<h2 class="h6 mb-0">
						{search.results.length} results for <strong class="text-light">“{syntax.query}”</strong>
					</h2>
					<small>{search.took.toFixed(0)} ms</small>
				</div>
				<div id="action-status" class="mb-3"></div>
				{search.results.length === 0 ? (
					<div class="alert search-result-item text-light border-secondary">
						Nothing matched. Try widening the filters.
					</div>
				) : (
					<div class="list-group">{search.results.map(ResultCard)}</div>
				)}
			</div>
		);
	} catch (error) {
		return (
			<div id="search-results" class="alert alert-danger mt-4" role="alert">
				<strong>Search failed.</strong> {error instanceof Error ? error.message : "Unknown error"}
			</div>
		);
	}
}
