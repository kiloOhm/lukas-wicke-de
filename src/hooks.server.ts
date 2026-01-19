// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';

const BYPASS_PREFIXES = [
	// adjust to your actual route prefixes
	'/admin' // if you want all admin unlocalized
	// or be more specific:
	// '/admin/', '/upload', etc.
];

const BYPASS_PATHS = new Set([
	// multipart endpoints (adjust paths to match your routes)
	'/admin/uploadExtraPart',
	'/admin/prepareExtraMultipart',
	'/admin/completeExtraMultipart',
	'/admin/abortExtraMultipart'
]);

function shouldBypass(event: Parameters<Handle>[0]['event']): boolean {
	const pathname = new URL(event.request.url).pathname;

	// Always bypass non-GET/HEAD (important: POST uploads)
	if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
		return true;
	}

	// optionally also bypass certain paths/prefixes
	if (BYPASS_PATHS.has(pathname)) return true;
	for (const p of BYPASS_PREFIXES) {
		if (pathname.startsWith(p)) return true;
	}
	return false;
}

export const handle: Handle = async ({ event, resolve }) => {
	if (shouldBypass(event)) {
		return resolve(event);
	}

	return paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});
};
