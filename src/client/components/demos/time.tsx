import Core from "../../../core.js";

export const component = { id: "demos.time" } as const;
export const route = "/sse";

// this creates a channel that you can map stuff to
const timeChannel = Core.services.sse.registerChannel({
	pattern: /time/,
});

export default function TimeDemo() {
	return (
		<div id="time" sse-swap="time" hx-swap="morph" class="demo" sse-connect="/events/time">
			<h2>Server Side Events and Channels</h2>
			<span>{new Date().toISOString()}</span>
		</div>
	);
}

setInterval(async () => timeChannel.send("time", await TimeDemo()), 1000);
