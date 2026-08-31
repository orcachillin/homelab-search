import { DateTimeType, defineEntity, p } from "@mikro-orm/core";
import { IdBaseEntity } from "./id.js";

export const ResourceBaseEntity = defineEntity({
    name: "Resource",
    abstract: true,
    extends: IdBaseEntity,
    properties: {
        createdAt: p.datetime().onCreate(() => new Date()),
        updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date())
    }
})