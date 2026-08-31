import { init } from "@paralleldrive/cuid2";

export default class Id {
    public static get = init({
        fingerprint: "absurd",
        length: 10,
    })
}