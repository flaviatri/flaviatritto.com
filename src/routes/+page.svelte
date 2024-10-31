<!-- src/routes/pdf-viewer/+page.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
	import { pdfjsLib } from '$lib/pdfjs-worker';
	import { assets } from '$app/paths';
	import { slide } from 'svelte/transition';

	interface PageState {
		pageNum: number;
		canvas: HTMLCanvasElement | null;
		rendered: boolean;
		height: number;
		width: number;
		scale: number;
		actualHeight: number; // Original PDF page height
		actualWidth: number; // Original PDF page width
	}

	interface ViewerState {
		pdfDoc: PDFDocumentProxy | null;
		pageCount: number;
		loading: boolean;
		loadingProgress: number;
		pages: PageState[];
		containerWidth: number;
		containerHeight: number;
	}

	let state: ViewerState = {
		pdfDoc: null,
		pageCount: 0,
		loading: true,
		loadingProgress: 0,
		pages: [],
		containerWidth: 0,
		containerHeight: 0
	};

	let containerRef: HTMLDivElement;
	let observers: IntersectionObserver[] = [];
	const pdfUrl = `${assets}/portfolio.pdf`;
	const QUALITY_SCALE = 2; // Increase rendering quality
	const WIDTH_RATIO = 0.9; // Page width as percentage of container

	// Resize observer to handle container size changes
	let resizeObserver: ResizeObserver;

	function handleResize(entries: ResizeObserverEntry[]) {
		const entry = entries[0];
		if (entry) {
			state.containerWidth = entry.contentRect.width;
			state.containerHeight = entry.contentRect.height;
			calculatePageDimensions();
		}
	}

	async function loadPDF(): Promise<void> {
		try {
			const loadingTask: PDFDocumentLoadingTask = pdfjsLib.getDocument({
				url: pdfUrl,
				rangeChunkSize: 65536
			});

			loadingTask.onProgress = (progress: { loaded: number; total: number }) => {
				if (progress.total > 0) {
					state.loadingProgress = Math.round((progress.loaded / progress.total) * 100);
				}
			};

			state.pdfDoc = await loadingTask.promise;
			state.pageCount = state.pdfDoc.numPages;

			// Initialize page states
			state.pages = Array.from({ length: state.pageCount }, (_, i) => ({
				pageNum: i + 1,
				canvas: null,
				rendered: false,
				height: 0,
				width: 0,
				scale: 1,
				actualHeight: 0,
				actualWidth: 0
			}));

			state.loading = false;

			await calculatePageDimensions();
			setupIntersectionObservers();
		} catch (error) {
			console.error('Error loading PDF:', error);
			state.loading = false;
		}
	}

	async function calculatePageDimensions(): Promise<void> {
		if (!state.pdfDoc || !state.containerWidth) return;

		for (let i = 0; i < state.pageCount; i++) {
			const page = await state.pdfDoc.getPage(i + 1);
			const viewport = page.getViewport({ scale: 1.0 });

			// Store actual dimensions
			state.pages[i].actualWidth = viewport.width;
			state.pages[i].actualHeight = viewport.height;

			// Calculate scale to fit width while maintaining aspect ratio
			const targetWidth = state.containerWidth * WIDTH_RATIO;
			const scale = targetWidth / viewport.width;

			// Calculate dimensions maintaining aspect ratio
			const scaledWidth = viewport.width * scale;
			const scaledHeight = viewport.height * scale;

			state.pages[i].width = scaledWidth;
			state.pages[i].height = scaledHeight;
			state.pages[i].scale = scale;

			// If already rendered, re-render with new dimensions
			if (state.pages[i].rendered && state.pages[i].canvas) {
				state.pages[i].rendered = false;
				renderPage(state.pages[i]);
			}
		}
	}

	async function renderPage(pageState: PageState): Promise<void> {
		if (!state.pdfDoc || pageState.rendered || !pageState.canvas) return;

		try {
			const page = await state.pdfDoc.getPage(pageState.pageNum);

			// Calculate render dimensions at higher quality
			const renderScale = pageState.scale * QUALITY_SCALE;
			const viewport = page.getViewport({ scale: renderScale });

			// Set canvas size to the high-quality dimensions
			pageState.canvas.width = viewport.width;
			pageState.canvas.height = viewport.height;

			// Set display size to the regular scale using CSS
			pageState.canvas.style.width = `${pageState.width}px`;
			pageState.canvas.style.height = `${pageState.height}px`;

			const ctx = pageState.canvas.getContext('2d', { alpha: false });
			if (!ctx) throw new Error('Canvas 2D context not available');

			// Set rendering context properties for better quality
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = 'high';

			await page.render({
				canvasContext: ctx,
				viewport,
				background: 'rgb(255, 255, 255)'
			}).promise;

			pageState.rendered = true;
		} catch (error) {
			console.error(`Error rendering page ${pageState.pageNum}:`, error);
		}
	}

	function setupIntersectionObservers(): void {
		observers.forEach((observer) => observer.disconnect());
		observers = [];

		state.pages.forEach((pageState, index) => {
			const observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting && !pageState.rendered) {
							renderPage(pageState);
						}
					});
				},
				{
					rootMargin: '200px 0px',
					threshold: 0.1
				}
			);

			const pageElement = containerRef?.querySelector(`[data-page="${index + 1}"]`);
			if (pageElement) {
				observer.observe(pageElement);
				observers.push(observer);
			}
		});
	}

	onMount(() => {
		loadPDF();
		resizeObserver = new ResizeObserver(handleResize);
		if (containerRef) {
			resizeObserver.observe(containerRef);
		}
	});

	onDestroy(() => {
		observers.forEach((observer) => observer.disconnect());
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
	});
</script>

{#if state.loading}
	<div class="loading">
		<div class="progress-bar" style="width: {state.loadingProgress}%" />
	</div>
{:else}
	<div class="pdf-container" bind:this={containerRef}>
		{#each state.pages as page, i (page.pageNum)}
			<div
				class="page-container"
				data-page={page.pageNum}
				style="min-height: {page.height}px; min-width: {page.width}px;"
				transition:slide
			>
				<div class="page-wrapper">
					<canvas bind:this={page.canvas} class="page" />
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.loading {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: #f0f0f0;
		z-index: 1000;
	}

	.progress-bar {
		height: 100%;
		background-color: #4caf50;
		transition: width 0.3s ease;
	}

	.pdf-container {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		overflow-y: auto;
		overflow-x: hidden;
		background: #1a1a1a;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 20px;
		box-sizing: border-box;
	}

	.page-container {
		margin: 12px 0;
		display: flex;
		justify-content: center;
		opacity: 0;
		transform: translateY(20px);
		animation: fadeIn 0.3s ease forwards;
	}

	.page-wrapper {
		background: white;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
		border-radius: 2px;
		transition: transform 0.2s ease;
	}

	.page-wrapper:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
	}

	.page {
		display: block;
		border-radius: 2px;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Hide scrollbar for Chrome, Safari and Opera */
	.pdf-container::-webkit-scrollbar {
		display: none;
	}

	/* Hide scrollbar for IE, Edge and Firefox */
	.pdf-container {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
