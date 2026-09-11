import { hostname } from "node:os";
import AbstractProvider, { MediaSource, MediaType } from "../abstractProvider.js";
import { SearchParams, SearchResults } from "../searchManager.js";
import { Jellyfin } from "@jellyfin/sdk/lib/jellyfin.js"

export default class JellyfinProvider extends AbstractProvider<"jellyfin"> {
    public readonly displayName: string = "Jellyfin"

    private client: Jellyfin

    constructor() {
        super("jellyfin", [MediaType.Movie, MediaType.TvShow, MediaType.Anime], MediaSource.Local)

        this.client = new Jellyfin({
            clientInfo: "homelab-search",
            deviceInfo: `${hostname()} node${process.version}`
        })
    }

    public async init(): Promise<void> {
        this.client.createApi()
    }

    public async query(params: SearchParams): Promise<SearchResults> {

        return {

        }
    }
}