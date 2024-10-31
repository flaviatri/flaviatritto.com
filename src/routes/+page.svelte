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
	}

	interface ViewerState {
		pdfDoc: PDFDocumentProxy | null;
		pageCount: number;
		loading: boolean;
		loadingProgress: number;
		pages: PageState[];
	}

	let state: ViewerState = {
		pdfDoc: null,
		pageCount: 0,
		loading: true,
		loadingProgress: 0,
		pages: []
	};

	let containerRef: HTMLDivElement;
	let observers: IntersectionObserver[] = [];
	const pdfUrl = `${assets}/portfolio.pdf`;
	const MAX_WIDTH = 1000; // Maximum width for pages

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
				width: 0
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
		if (!state.pdfDoc) return;

		for (let i = 0; i < state.pageCount; i++) {
			const page = await state.pdfDoc.getPage(i + 1);
			const viewport = page.getViewport({ scale: 1.0 });

			// Calculate scale to fit within MAX_WIDTH while maintaining aspect ratio
			const scale = Math.min(MAX_WIDTH / viewport.width, 1.5);
			const scaledViewport = page.getViewport({ scale });

			state.pages[i].width = scaledViewport.width;
			state.pages[i].height = scaledViewport.height;
		}
	}

	async function renderPage(pageState: PageState): Promise<void> {
		if (!state.pdfDoc || pageState.rendered || !pageState.canvas) return;

		try {
			const page = await state.pdfDoc.getPage(pageState.pageNum);
			const viewport = page.getViewport({ scale: 1.0 });

			// Calculate scale to fit within MAX_WIDTH while maintaining aspect ratio
			const scale = Math.min(MAX_WIDTH / viewport.width, 1.5);
			const scaledViewport = page.getViewport({ scale });

			pageState.canvas.width = scaledViewport.width;
			pageState.canvas.height = scaledViewport.height;

			const ctx = pageState.canvas.getContext('2d');
			if (!ctx) throw new Error('Canvas 2D context not available');

			await page.render({
				canvasContext: ctx,
				viewport: scaledViewport
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
	});

	onDestroy(() => {
		observers.forEach((observer) => observer.disconnect());
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
		background: #333;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.page-container {
		margin: 8px 0;
		display: flex;
		justify-content: center;
		opacity: 0;
		transform: translateY(20px);
		animation: fadeIn 0.3s ease forwards;
	}

	.page-wrapper {
		background: white;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		transition: opacity 0.3s ease;
	}

	.page {
		display: block;
		width: 100%;
		height: 100%;
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
