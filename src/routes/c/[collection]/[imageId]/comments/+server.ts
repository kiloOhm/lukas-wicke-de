import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '../$types';
import { createDb } from '../../../../../server/db/client';
import { getComments, addComment } from '../../../../../server/comments.service';

type RateLimitState = {
	ts: number;
	count: number;
};

const RATE_LIMIT_MAX = 5; // max comments
const RATE_LIMIT_WINDOW_SEC = 60; // per 60 seconds

async function checkRateLimit(
	platform: Readonly<App.Platform>,
	request: Request
): Promise<Response | null> {
	// If no KV bound, just skip rate limiting
	const kv = platform?.env?.KV;
	if (!kv) {
		return null;
	}

	const ipHeader =
		request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown';
	const ip = ipHeader.split(',')[0].trim();

	const key = `rate:comment:${ip}`;
	const now = Date.now();

	let state = (await kv.get(key, { type: 'json' })) as RateLimitState | null;
	if (!state || now - state.ts > RATE_LIMIT_WINDOW_SEC * 1000) {
		state = { ts: now, count: 0 };
	}

	if (state.count >= RATE_LIMIT_MAX) {
		// Plain text so the client can show a nice alert with res.text()
		return new Response('Too many comments, please slow down.', { status: 429 });
	}

	state.count += 1;

	await kv.put(key, JSON.stringify(state), {
		// TTL a bit longer than the window so the key expires by itself
		expirationTtl: RATE_LIMIT_WINDOW_SEC * 2
	});

	return null;
}

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform) throw error(500, 'Platform not available');
	const { collection, imageId } = params;
	if (!collection || !imageId) throw error(400, 'Missing collection or imageId');

	const db = createDb(platform.env.DB);
	const comments = await getComments(db, collection, imageId);
	return json({ comments });
};

export const POST: RequestHandler = async ({ request, params, platform }) => {
	if (!platform) throw error(500, 'Platform not available');
	const { collection, imageId } = params;
	if (!collection || !imageId) throw error(400, 'Missing collection or imageId');

	// Rate limiting
	const rateLimitResponse = await checkRateLimit(platform, request);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	const { text, name } = (body ?? {}) as { text?: string; name?: string };
	const trimmed = (text ?? '').trim();
	if (!trimmed) throw error(400, 'Comment text is required');

	const db = createDb(platform.env.DB);
	const comment = await addComment(db, collection, imageId, trimmed, name);

	return json({ comment });
};
