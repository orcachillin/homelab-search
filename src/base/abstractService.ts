import Core from "../core.js";
import { Logger } from "../util/logger.js";
import { Service } from "./service.js";

export default abstract class AbstractService<Name extends string> implements Service<Name> {

    protected logger: Logger;
    constructor(public readonly name: Name) {
        this.logger = new Logger(this.name);
    }

    public async init(): Promise<void> {

    }

    public async destroy(): Promise<void> {

    }

}
