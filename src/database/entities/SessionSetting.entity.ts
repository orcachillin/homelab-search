import { type Rel } from "@mikro-orm/core";
import { Session } from "./Session.entity.js";
import { Entity, ManyToOne, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";


// same as user settings, but used for storing stuff for not logged in users
@Entity()
export default class SessionSetting {
    @PrimaryKey({
        type: "varchar",
        length: 64
    })
    id: string

    @ManyToOne({
        entity: () => Session,
        deleteRule: 'cascade'
    })
    session: Rel<Session>

    @Property({
        type: "text"
    })
    value: string

    constructor(session: Rel<Session>, key: string, value: string) {
        this.id = `${session.id}:${key}`
        this.session = session
        this.value = value
    }

    get key() {
        return this.id.split(":").slice(1).join(":")
    }


}