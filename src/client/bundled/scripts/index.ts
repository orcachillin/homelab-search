// import styles
import "../styles/global.scss"

import "htmx.org"
import "htmx-ext-preload"
import "htmx-ext-sse"
import "idiomorph"

let activityOpen = false
let activityScrollTop = 0

function updateSearchOptions(form: HTMLFormElement) {
    const providerInputs = [...form.querySelectorAll<HTMLInputElement>('input[name="providers"]:not(:disabled)')]
    const selectedProviders = providerInputs.filter((input) => input.checked).map((input) => input.value)
    const activeProviders = selectedProviders.length > 0 ? selectedProviders : providerInputs.map((input) => input.value)

    form.querySelectorAll<HTMLElement>("[data-supported-providers]").forEach((control) => {
        const supported = (control.dataset.supportedProviders ?? "").split(",")
        const enabled = activeProviders.some((provider) => supported.includes(provider))
        const input = control.querySelector<HTMLInputElement>("input")
        control.classList.toggle("disabled", !enabled)
        control.setAttribute("aria-disabled", String(!enabled))
        if (input) {
            input.disabled = !enabled
            if (!enabled) input.checked = false
            control.classList.toggle("active", input.checked)
        }
    })
}

function updateInlineFilters(form: HTMLFormElement) {
    const query = form.querySelector<HTMLInputElement>('input[name="query"]')?.value ?? ""
    const filters = new Map<string, Set<string>>()
    for (const match of query.matchAll(/(?:^|\s)(provider|media|source|type):([^\s]+)/gi)) {
        const key = match[1].toLowerCase()
        const values = filters.get(key) ?? new Set<string>()
        match[2].toLowerCase().split(",").filter(Boolean).forEach((value) => values.add(value))
        filters.set(key, values)
    }

    syncInlineGroup(form.querySelectorAll<HTMLInputElement>('input[name="providers"]'), filters.get("provider"), (input, requested) =>
        [...requested].some((value) => input.value === value || input.value.startsWith(`${value}.`)))
    syncInlineGroup(form.querySelectorAll<HTMLInputElement>('input[name="mediaTypes"]'), filters.get("media"), (input, requested) =>
        requested.has(input.closest<HTMLElement>("[data-filter-value]")?.dataset.filterValue ?? ""))
    syncInlineGroup(form.querySelectorAll<HTMLInputElement>('input[name="sources"]'), filters.get("source"), (input, requested) =>
        requested.has(input.closest<HTMLElement>("[data-filter-value]")?.dataset.filterValue ?? ""))
    syncInlineGroup(form.querySelectorAll<HTMLInputElement>('input[name="resultTypes"]'), filters.get("type"), (input, requested) =>
        requested.has(input.closest<HTMLElement>("[data-filter-value]")?.dataset.filterValue ?? ""))

    const limit = /(?:^|\s)limit:(\d+)/i.exec(query)?.[1]
    const select = form.querySelector<HTMLSelectElement>('select[name="limit"]')
    if (select && limit) {
        select.dataset.inlinePrevious ??= select.value
        if ([...select.options].some((option) => option.value === limit)) select.value = limit
    } else if (select?.dataset.inlinePrevious) {
        select.value = select.dataset.inlinePrevious
        delete select.dataset.inlinePrevious
    }
    updateSearchOptions(form)
}

function syncInlineGroup(
    inputs: NodeListOf<HTMLInputElement>,
    requested: Set<string> | undefined,
    matches: (input: HTMLInputElement, requested: Set<string>) => boolean,
) {
    inputs.forEach((input) => {
        if (requested) {
            input.dataset.inlinePrevious ??= String(input.checked)
            input.checked = matches(input, requested)
        } else if (input.dataset.inlinePrevious) {
            input.checked = input.dataset.inlinePrevious === "true"
            delete input.dataset.inlinePrevious
        }
        input.closest(".btn")?.classList.toggle("active", input.checked)
    })
}

document.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement
    if (input.name !== "query") return
    const form = input.closest<HTMLFormElement>("#search-form")
    if (form) {
        updateInlineFilters(form)
    }
}, true)

document.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement
    const form = input.closest<HTMLFormElement>("#search-form")
    if (!form) return
    input.closest(".btn")?.classList.toggle("active", input.checked)
    if (input.name === "providers") updateSearchOptions(form)
}, true)

document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement
    if (target.closest("[data-activity-toggle]")) {
        activityOpen = !activityOpen
        document.querySelector<HTMLElement>("#provider-activity")?.setAttribute("data-open", String(activityOpen))
    }
    if (target.closest("[data-activity-all]")) activityOpen = true
})

document.addEventListener("htmx:beforeRequest", (event) => {
    const target = event.target as HTMLElement
    if (!target.closest("[data-download-action]")) return
    activityOpen = true
    document.querySelector<HTMLElement>("#provider-activity")?.setAttribute("data-open", "true")
})

document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector<HTMLFormElement>("#search-form")
    if (form) updateSearchOptions(form)
})

document.addEventListener("htmx:afterSwap", () => {
    const form = document.querySelector<HTMLFormElement>("#search-form")
    if (form) updateSearchOptions(form)
    const activity = document.querySelector<HTMLElement>("#provider-activity-content")
    if (activity) activity.scrollTop = activityScrollTop
})

document.addEventListener("htmx:beforeSwap", (event) => {
    const target = (event as CustomEvent<{ target?: HTMLElement }>).detail?.target
    if (target?.id === "provider-activity-content") activityScrollTop = target.scrollTop
})
