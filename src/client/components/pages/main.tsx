import Core from "../../../core.js";
import { parseSearchSyntax } from "../../../services/provider/searchSyntax.js";
import { get as ProviderActivity } from "../activity.js";
import { SearchForm } from "../search/SearchForm.js";
import { SearchResults } from "../search/SearchResults.js";
import { values, type SearchProps } from "../search/searchOptions.js";

export const component = { id: "pages.main" } as const;
export const route = "/";
export const noCache = true;

export async function get(props: SearchProps) {
	const readyProviders = [...Core.services.provider.providers.values()];
	const syntax = parseSearchSyntax(props.query ?? "", readyProviders.map((provider) => provider.name));

	return <section class="search-shell">
		{await ProviderActivity()}
		<div class="search-main">
			<header class="mb-4">
				<h1>Homelab Search</h1>
				<p class="lead text-muted">Search across your configured services.</p>
			</header>
			<SearchForm
				props={props}
				selectedProviders={syntax.providers.length > 0 ? syntax.providers : values(props.providers)}
				selectedMedia={syntax.mediaTypes.length > 0 ? syntax.mediaTypes.map(String) : values(props.mediaTypes)}
				selectedSources={syntax.sources.length > 0 ? syntax.sources.map(String) : values(props.sources)}
				selectedResultTypes={syntax.resultTypes.length > 0 ? syntax.resultTypes : values(props.resultTypes)}
				selectedLimit={String(syntax.limit ?? Number.parseInt(props.limit ?? "20", 10))}
			/>
			{await SearchResults(props)}
		</div>
	</section>;
}
