import Core from "../../core.js";
import { Session } from "../../database/entities/Session.entity.js";

export default async function Head() {
	const session = Core.services.context.get<Session>("session");

	let theme = "dark";

	if (session) {
		theme = (await Core.services.settings.getOrSetDefault(session, "theme", theme)) || theme;
	}

	return (
		<>
			<head>
				<script type="module" src="/__/index.js"></script>
				<link rel="stylesheet" href="/__/index.css"></link>
				<link rel="icon" href="/_/icon.webp" />
			</head>
			<script>
				window.state = window.state || {"{}"}; window.state.theme = '{theme}';
			</script>
		</>
	);
}
