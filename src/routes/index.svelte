<script lang="ts">
	import { assets } from '$app/paths';
</script>

<div>
	<object
		data="{assets}/Tritto-Portfolio.pdf"
		title="portfolio"
		type="application/pdf"
		width="100%"
		height="100%"
	/>
	<!-- <iframe
		title="portfolio"
		src="https://drive.google.com/file/d/1ouFVaUXEiOjHZawUqbsYOIoJGQ28sHWS/preview"
		width="100%"
		height="100%"
		allow="autoplay"
	/> -->
</div>

<style>
	:global(body, html) {
		margin: 0;
		padding: 0;
	}

	div {
		height: 100vh;
		width: 100vw;
	}
</style>
