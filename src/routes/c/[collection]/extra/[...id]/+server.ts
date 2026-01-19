import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '../../../../../server/db/client';
import { getCollectionByName } from '../../../../../server/collections.service';

function sanitizeFilename(name: string): string {
	// basic safe filename for Content-Disposition
	return name.replace(/[\r\n"]/g, '_');
}

export const GET: RequestHandler = async ({ platform, params, url, cookies }) => {
	if (!platform) {
		throw error(500, 'Platform not available');
	}

	const db = createDb(platform.env.DB);
	const collection = await getCollectionByName(db, params.collection);
	if (!collection) {
		throw error(404, 'Collection not found');
	}

	// Same auth logic as page load
	const providedAuth = url.searchParams.get('k');
	const cookieAuth = cookies.get('auth_' + collection.name);
	const authorized = providedAuth === collection.password || cookieAuth === collection.password;

	if (!authorized) {
		throw error(403, 'Not authorized');
	}

	const fileId = params.id;
	const extra = (collection.extraFiles ?? []).find((x) => x.id === fileId);
	if (!extra) {
		throw error(404, 'File not found');
	}

	const obj = await platform.env.OBJ_STORAGE.get(fileId);
	if (!obj) {
		throw error(404, 'File not found');
	}

	const headers = new Headers();

	// Preserve content-type if present
	const contentType = obj.httpMetadata?.contentType;
	if (contentType) {
		headers.set('Content-Type', contentType);
	} else {
		headers.set('Content-Type', 'application/octet-stream');
	}

	// Force download
	headers.set('Content-Disposition', `attachment; filename="${sanitizeFilename(extra.name)}"`);

	// Optional: allow browsers to show progress
	const size = obj.size;
	if (typeof size === 'number') {
		headers.set('Content-Length', String(size));
	}

	// Optional: private caching
	headers.set('Cache-Control', 'private, max-age=0, must-revalidate');

	return new Response(obj.body, { headers });
};
