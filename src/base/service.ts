export interface Service<Name extends string = string> {
    name: Name;
    init(): Promise<void>;
    destroy(): Promise<void>;
}