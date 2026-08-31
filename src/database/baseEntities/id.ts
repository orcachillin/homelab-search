import { defineEntity, p } from "@mikro-orm/core";
import Id from "../../util/id.js";

export const IdBaseEntity = defineEntity({
    name: "IdBaseEntity",
    abstract: true,
    properties: {
        id: p.string().primary().length(10).onCreate(() => Id.get()),
    }
})