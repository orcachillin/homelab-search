import { Cascade, Collection, type Rel } from "@mikro-orm/core";
import SessionSetting from "./SessionSetting.entity.js";
import { Entity, ManyToOne, OneToMany, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

@Entity()
export class Session {

    @PrimaryKey({
        type: "varchar",
        length: 16
    })
    id: string = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

    @OneToMany({
        entity: () => SessionSetting,
        mappedBy: "session",
        cascade: [Cascade.REMOVE],
    })
    settings = new Collection<SessionSetting>(this);

    @Property({
        type: "varchar",
        length: 128
    })
    userAgent!: string

    @Property()
    lastUsed: Date = new Date();

    public get serialized(): string {
        return `$ses||${this.id}||${this.userAgent}||${this.lastUsed.getTime()}`;
    }

    public static deserialize(serialized: string): Session | undefined {
        const parts = serialized.split("||");
        if (parts.length !== 4 || parts[0] !== "$ses") {
            return undefined;
        }

        const session = new Session();
        session.id = parts[1];
        session.userAgent = parts[2];
        session.lastUsed = new Date(parseInt(parts[3], 10));

        return session;
    }
}
