import { p } from "@mikro-orm/core";

export class BitflagFactory<Values extends readonly string[]> {
    constructor(public readonly flags: Values) { }

    public getFlagValue(flag: Values[number]): number {
        return 1 << this.flags.indexOf(flag);
    }

    public construct(data: Record<Values[number], boolean>, onWrite?: (value: number) => any): Bitflag<Values> {
        let value = 0

        for (const key of Object.entries(data)) {
            if (key[1]) {
                value |= this.getFlagValue(key[0]);
            }
        }

        return new Bitflag(this, value, onWrite)
    }

    public from(value: number, onWrite?: (value: number) => any) {
        return new Bitflag(this, value, onWrite);
    }
}

export class Bitflag<Values extends readonly string[]> {
    constructor(private _factory: BitflagFactory<Values>, private _value: number, private readonly _onCommit?: (value: number) => any) { }

    public read(flag: Values[number]) {
        return (this._value & this._factory.getFlagValue(flag)) !== 0;
    }

    /**
     * do not write to this object, changes do not persist
     */
    public readAll() {
        return this._factory.flags.reduce((acc, flag: Values[number]) => {
            acc[flag] = (this._value & this._factory.getFlagValue(flag)) !== 0;
            return acc
        }, {} as Record<Values[number], boolean>)
    }

    private _writeNoCommit(flag: Values[number], value: boolean) {
        if (value) {
            this._value |= this._factory.getFlagValue(flag);
        } else {
            this._value &= ~this._factory.getFlagValue(flag);
        }
    }

    private _commit() {
        this._onCommit && this._onCommit(this._value)
    }

    public write(flag: Values[number], value: boolean) {
        this._writeNoCommit(flag, value)
        this._commit()
    }

    public writeMany(flags: FlagConstructor<Values>) {
        for (const flag in flags) {
            const value = flags[flag as Values[number]]
            if (!value) continue

            this._writeNoCommit(flag, value);
        }

        this._commit()
    }

    public get value() {
        return this._value
    }


}

export const BitflagProperty = (name?: string) => p.integer().name(name || "flags").default(0)

export type FlagConstructor<TypeArray extends readonly string[]> = Partial<Record<TypeArray[number], boolean>>
export type InferFactoryType<Factory extends BitflagFactory<any>> = Record<Factory["flags"][number], boolean> 