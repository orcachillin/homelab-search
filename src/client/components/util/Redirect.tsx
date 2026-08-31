export function Redirect(props: { location: string }) {
	return <script>window.location.href = "{props.location}"</script>;
}
