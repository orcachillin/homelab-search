export type TimeUnitsShort = "ms" | "s" | "m" | "h" | "d" | "w" | "mt" | "y";
export type TimeUnitsLongSingularLowercase =
    | "millisecond"
    | "second"
    | "minute"
    | "hour"
    | "day"
    | "week"
    | "month"
    | "year";
export type TimeUnitsLongSingularUppercase =
    | "Millisecond"
    | "Second"
    | "Minute"
    | "Hour"
    | "Day"
    | "Week"
    | "Month"
    | "Year";
export type TimeUnitsLong = `${TimeUnitsLongSingularLowercase | TimeUnitsLongSingularUppercase}s`;
export type TimeUnits =
    | TimeUnitsShort
    | TimeUnitsLong
    | TimeUnitsLongSingularLowercase
    | TimeUnitsLongSingularUppercase;

export type TimeValue = `${number} ${TimeUnits}` | `${number}${TimeUnits}` | number;
export type TimeValueArray = TimeValue | TimeValue[];

export function time(time: TimeValueArray) {
    return new Time(time);
}

export function ms(time: TimeValueArray) {
    return new Time(time).ms();
}

export default class Time {
    public static readonly MILLISECOND = 1;
    public static readonly SECOND = Time.MILLISECOND * 1000;
    public static readonly MINUTE = Time.SECOND * 60;
    public static readonly HOUR = Time.MINUTE * 60;
    public static readonly DAY = Time.HOUR * 24;
    public static readonly WEEK = Time.DAY * 7;
    public static readonly MONTH = Time.DAY * 30.4167;
    public static readonly YEAR = Time.DAY * 365;

    public static readonly timeRegex =
        /(?<amount>\d+) *(?<unit>millisecond|second|minute|hour|day|week|month|year|ms|mt|s|m|h|d|w|y)s*/gi;

    public time: number;

    constructor(time: TimeValueArray | number | string | Date) {
        let timeArray: TimeValueArray;
        if (typeof time === "string") {
            if (time.includes(",")) {
                const arr = time.split(",");
                timeArray = arr.map((t) => t.trim()) as TimeValueArray;
            } else {
                timeArray = [time] as TimeValueArray;
            }
            this.time = Time.convert(timeArray);
            return;
        }

        if (typeof time === "number") {
            this.time = time;
            return;
        } else if (time instanceof Date) {
            this.time = time.getTime();
            return;
        } else {
            timeArray = time as TimeValueArray;
            this.time = Time.convert(timeArray);
            return;
        }
    }
    /**
     * Get the milliseconds of the time value.
     */
    public getTime(): number {
        return this.time;
    }
    /**
     * Get the milliseconds of the time value.
     */
    public ms(): number {
        return this.time;
    }
    /**
     * Get the seconds of the time value.
     * @returns {number}
     */

    public s(): number {
        return this.time / Time.SECOND;
    }

    /**
     * Get the minutes of the time value.
     * @returns {number}
     */

    public m(): number {
        return this.time / Time.MINUTE;
    }

    /**
     * Get the hours of the time value.
     * @returns {number}
     */

    public h(): number {
        return this.time / Time.HOUR;
    }

    /**
     * Get the days of the time value.
     * @returns {number}
     */
    public d(): number {
        return this.time / Time.DAY;
    }

    /**
     *  Get the weeks of the time value.
     * @returns {number}
     */
    public w(): number {
        return this.time / Time.WEEK;
    }

    /**
     * Get the months of the time value.
     * @returns {number}
     */
    public mt(): number {
        return this.time / Time.MONTH;
    }

    /**
     * Get the years of the time value.
     * @returns {number}
     */
    public y(): number {
        return this.time / Time.YEAR;
    }

    /**
     * Get the time value as a Date object.
     * @returns {Date}
     */
    public toDate(): Date {
        return new Date(this.time);
    }

    public get [Symbol.toStringTag](): string {
        return "Time";
    }

    public get [Symbol.toPrimitive](): number {
        return this.time;
    }

    public fromNow(): Time {
        return new Time(Date.now() + this.time);
    }

    public ago(): Time {
        return new Time(Date.now() - this.time);
    }

    public toString(short = false, skipUnits = 0): string {
        const time = this.ms();
        return Time.toTimeString(time, short, skipUnits);
    }

    private static splitTime(time: TimeValue): [number, TimeUnits] {
        const match = time.toString().match(Time.timeRegex.source)?.groups;
        if (!match) return [0, "ms"];
        return [parseInt(match.amount), match.unit as TimeUnits];
    }

    public static toTimeString(ms: number, short = false, skipUnits: number = 0): string {
        const years = Math.floor(ms / Time.YEAR);
        ms -= years * Time.YEAR;
        const months = Math.floor(ms / Time.MONTH);
        ms -= months * Time.MONTH;
        const weeks = Math.floor(ms / Time.WEEK);
        ms -= weeks * Time.WEEK;
        const days = Math.floor(ms / Time.DAY);
        ms -= days * Time.DAY;
        const hours = Math.floor(ms / Time.HOUR);
        ms -= hours * Time.HOUR;
        const minutes = Math.floor(ms / Time.MINUTE);
        ms -= minutes * Time.MINUTE;
        const seconds = Math.floor(ms / Time.SECOND);
        ms -= seconds * Time.SECOND;

        const yearUnit = short ? "y" : `year${years > 1 ? "s" : ""},`;
        const monthUnit = short ? "mt" : `month${months > 1 ? "s" : ""},`;
        const weekUnit = short ? "w" : `week${weeks > 1 ? "s" : ""},`;
        const dayUnit = short ? "d" : `day${days > 1 ? "s" : ""},`;
        const hourUnit = short ? "h" : `hour${hours > 1 ? "s" : ""},`;
        const minuteUnit = short ? "m" : `minute${minutes > 1 ? "s" : ""},`;
        const secondUnit = short ? "s" : `second${seconds > 1 ? "s" : ""},`;
        const msUnit = short ? "ms" : `millisecond${ms > 1 ? "s" : ""},`;

        let time = "";
        if (years > 0) time += `${years}${short ? "" : " "}${yearUnit} `;
        if (skipUnits <= 6 && months > 0) time += `${months}${short ? "" : " "}${monthUnit} `;
        if (skipUnits <= 5 && weeks > 0) time += `${weeks}${short ? "" : " "}${weekUnit} `;
        if (skipUnits <= 4 && days > 0) time += `${days}${short ? "" : " "}${dayUnit} `;
        if (skipUnits <= 3 && hours > 0) time += `${hours}${short ? "" : " "}${hourUnit} `;
        if (skipUnits <= 2 && minutes > 0) time += `${minutes}${short ? "" : " "}${minuteUnit} `;
        if (skipUnits <= 1 && seconds > 0) time += `${seconds}${short ? "" : " "}${secondUnit} `;
        if (skipUnits <= 0 && ms > 0) time += `${ms}${short ? "" : " "}${msUnit} `;

        if (time.length > 0 && time.includes(",")) time = time.substring(0, time.lastIndexOf(","));
        if (time.length === 0) time = short ? "0s" : "0 seconds";

        return time;
    }

    public static formatDate(ms: number | Date, format: string = "MM/DD/YYYY HH:mm:ss"): string {
        const date = ms instanceof Date ? ms : new Date(ms);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();
        const milliseconds = date.getMilliseconds();

        return format
            .replace(/YYYY/g, year.toString())
            .replace(/MM/g, month.toString().padStart(2, "0"))
            .replace(/DD/g, day.toString().padStart(2, "0"))
            .replace(/HH/g, hours.toString().padStart(2, "0"))
            .replace(/mm/g, minutes.toString().padStart(2, "0"))
            .replace(/ss/g, seconds.toString().padStart(2, "0"))
            .replace(/SSS/g, milliseconds.toString().padStart(3, "0"));
    }

    public static toRelativeTime(ms: number, from: number, short = false, skipUnits = 1): string {
        const diff = from - ms;
        const direction = diff > 0 ? "ago" : "from now";
        const time = Math.abs(diff);

        return `${new Time(time).toString(short, skipUnits)} ${direction}`;
    }

    public static toSingleUnitRelativeTime(ms: number, from: number, short = false): string {
        const diff = from - ms;
        const direction = diff > 0 ? "ago" : "from now";
        const time = Math.abs(diff);

        if (time < Time.SECOND) {
            return `${time} ${short ? "ms" : `millisecond${time > 1 ? "" : "s"}`} ${direction}`;
        } else if (time < Time.MINUTE) {
            return `${Math.round(time / Time.SECOND)} ${short ? "s" : `second${Math.round(time / Time.SECOND) > 1 ? "s" : ""}`} ${direction}`;
        } else if (time < Time.HOUR) {
            return `${Math.round(time / Time.MINUTE)} ${short ? "m" : `minute${Math.round(time / Time.MINUTE) > 1 ? "s" : ""}`} ${direction}`;
        } else if (time < Time.DAY) {
            return `${Math.round(time / Time.HOUR)} ${short ? "h" : `hour${Math.round(time / Time.HOUR) > 1 ? "s" : ""}`} ${direction}`;
        } else if (time < Time.WEEK) {
            return `${Math.round(time / Time.DAY)} ${short ? "d" : `day${Math.round(time / Time.DAY) > 1 ? "s" : ""}`} ${direction}`;
        } else if (time < Time.MONTH) {
            return `${Math.round(time / Time.WEEK)} ${short ? "w" : `week${Math.round(time / Time.WEEK) > 1 ? "s" : ""}`} ${direction}`;
        } else if (time < Time.YEAR) {
            return `${Math.round(time / Time.MONTH)} ${short ? "mt" : `month${Math.round(time / Time.MONTH) > 1 ? "s" : ""}`} ${direction}`;
        } else {
            return `${Math.round(time / Time.YEAR)} ${short ? "y" : `year${Math.round(time / Time.YEAR) > 1 ? "s" : ""}`} ${direction}`;
        }
    }

    public static preferredRelativeTime(ms: number, threshhold = Time.DAY, short = false): string {
        const now = Date.now();
        const diff = now - ms;
        const time = Math.abs(diff);

        if (time < threshhold) {
            return Time.toSingleUnitRelativeTime(ms, now, short);
        } else {
            return Time.formatDate(ms);
        }
    }


    public static convertSingle(time: [number, TimeUnits]): number {
        const ms = time[0];
        const unit = time[1].toLowerCase();

        switch (unit) {
            case "ms":
            case "millisecond":
            case "milliseconds":
                return ms;
            case "s":
            case "second":
            case "seconds":
                return Math.round(ms * Time.SECOND);
            case "m":
            case "minute":
            case "minutes":
                return Math.round(ms * Time.MINUTE);
            case "h":
            case "hour":
            case "hours":
                return Math.round(ms * Time.HOUR);
            case "d":
            case "day":
            case "days":
                return Math.round(ms * Time.DAY);
            case "w":
            case "week":
            case "weeks":
                return Math.round(ms * Time.WEEK);
            case "mt":
            case "month":
            case "months":
                return Math.round(ms * Time.MONTH);
            case "y":
            case "year":
            case "years":
                return Math.round(ms * Time.YEAR);
            default:
                throw new Error(`Unknown time unit: ${unit}`);
        }
    }

    public static convert(times: TimeValueArray): number {
        let total = 0;
        if (typeof times === "string" || typeof times == "number") times = [times];
        const units: TimeUnits[] = [];
        times.forEach((time, index) => {
            const u = Time.splitTime(time);
            if (units.includes(u[1])) throw new Error(`Duplicate time unit at position ${index}: ${u[1]}`);
            units.push(u[1]);
            const r = Time.convertSingle(u);
            total += r;
        });
        return total;
    }
}