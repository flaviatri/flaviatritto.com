import { dev } from '$app/environment';
import * as pdfjsLib from 'pdfjs-dist';

// Set correct worker path for dev and prod environments
if (dev) {
	pdfjsLib.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';
} else {
	// In production, we'll serve the worker from our static assets
	pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

export { pdfjsLib };
