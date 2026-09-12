import Core from "../../../core.js";
import { MediaSource } from "../../../services/provider/abstractProvider.js";
import { mediaOptions, providersSupportingMedia, providersSupportingResult, providersSupportingSource, resultTypeOptions, selected, sourceOptions, type SearchProps } from "./searchOptions.js";

interface SearchFormProps {
	props: SearchProps
	selectedProviders: string[]
	selectedMedia: string[]
	selectedSources: string[]
	selectedResultTypes: string[]
	selectedLimit: string
}

export function SearchForm({ props, selectedProviders, selectedMedia, selectedSources, selectedResultTypes, selectedLimit }: SearchFormProps) {
	const readyProviders = [...Core.services.provider.providers.values()];
	return <form
		id="search-form"
		class="card bg-dark border-secondary"
		hx-get="/-/pages.main"
		hx-target="#search-results"
		hx-select="#search-results"
		hx-swap="outerHTML"
		hx-indicator="#search-spinner"
		hx-trigger="submit, change delay:150ms"
	>
		<div class="card-body">
			<div class="input-group input-group-lg">
				<input type="search" name="query" class="form-control bg-dark text-light border-secondary" placeholder="Search music, movies, shows, books..." value={props.query ?? ""} autocomplete="off" inputmode="search"
					hx-get="/-/pages.main" hx-trigger="keyup changed delay:150ms, search" hx-target="#search-results" hx-select="#search-results" hx-swap="outerHTML" hx-include="#search-form" hx-indicator="#search-spinner" />
				<div class="input-group-append"><button class="btn btn-primary" type="submit"><span id="search-spinner" class="spinner-border spinner-border-sm htmx-indicator" aria-hidden="true"></span> Search</button></div>
			</div>

			<div class="mt-4">
				<fieldset>
					<legend class="h6">Providers</legend>
					<div class="btn-group-toggle d-flex flex-wrap" data-toggle="buttons">
						{Core.services.provider.providerList.map((provider) => <label class={`btn btn-sm btn-outline-light mr-2 mb-2 ${selected(selectedProviders, provider.name) ? "active" : ""} ${Core.services.provider.providers.has(provider.name) ? "" : "disabled"}`}>
							<input type="checkbox" name="providers" value={provider.name} checked={selected(selectedProviders, provider.name)} disabled={!Core.services.provider.providers.has(provider.name)} autocomplete="off" />
							{provider.icon && <img class="provider-icon mr-1" src={`/api/provider-icon?id=${encodeURIComponent(provider.icon)}`} alt="" />}{provider.displayName}
						</label>)}
						{readyProviders.length === 0 && <small class="text-warning">No providers are configured. Add credentials to your environment.</small>}
					</div>
				</fieldset>

				<fieldset>
					<legend class="h6 mt-2">Media</legend>
					<div class="btn-group-toggle d-flex flex-wrap" data-toggle="buttons">{mediaOptions.map(([value, label]) => <label class={`btn btn-sm btn-outline-light mr-2 mb-2 ${selected(selectedMedia, String(value)) ? "active" : ""}`} data-supported-providers={providersSupportingMedia(value)} data-filter-key="media" data-filter-value={label.toLowerCase()}>
						<input type="checkbox" name="mediaTypes" value={String(value)} checked={selected(selectedMedia, String(value))} autocomplete="off" />{label}
					</label>)}</div>
				</fieldset>

				<fieldset>
					<legend class="h6 mt-2">Result type</legend>
					<div class="btn-group-toggle d-flex flex-wrap" data-toggle="buttons">{resultTypeOptions.map(([value, label]) => <label class={`btn btn-sm btn-outline-light mr-2 mb-2 ${selected(selectedResultTypes, value) ? "active" : ""}`} data-supported-providers={providersSupportingResult(value)} data-filter-key="type" data-filter-value={value}>
						<input type="checkbox" name="resultTypes" value={value} checked={selected(selectedResultTypes, value)} autocomplete="off" />{label}
					</label>)}</div>
				</fieldset>

				<div class="d-flex flex-wrap align-items-end justify-content-between mt-2">
					<fieldset><legend class="h6">Sources</legend><div class="btn-group-toggle d-flex flex-wrap" data-toggle="buttons">{sourceOptions.map(([value, label]) => <label class={`btn btn-sm btn-outline-light mr-2 mb-2 ${selected(selectedSources, String(value)) ? "active" : ""}`} data-source-option data-supported-providers={providersSupportingSource(value)} data-filter-key="source" data-filter-value={value === MediaSource.Local ? "local" : value === MediaSource.Download ? "download" : "streamed"}>
						<input type="checkbox" name="sources" value={String(value)} checked={selected(selectedSources, String(value))} autocomplete="off" />{label}
					</label>)}</div></fieldset>
					<label class="form-inline text-muted mb-2">Results <select name="limit" class="custom-select custom-select-sm bg-dark text-light border-secondary ml-2">{[10, 20, 50, 100].map((limit) => <option value={String(limit)} selected={selectedLimit === String(limit)}>{limit}</option>)}</select></label>
				</div>
				<small class="form-text text-muted">Leave a group unchecked to search all available options.</small>
			</div>
		</div>
	</form>;
}
