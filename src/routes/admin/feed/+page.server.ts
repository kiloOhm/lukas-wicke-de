import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isAuthenticated } from '../../../server/auth.service';
import { createDb, schema } from '../../../server/db/client';
import { getComments } from '../../../server/comments.service';
import { useCloudflareImagesService } from '../../../server/cloudflare.service';
import { inArray } from 'drizzle-orm';

export const load: PageServerLoad = async ({ platform, cookies }) => {
	if (!platform) {
		throw new Error('Platform not available');
	}
	const authenticated = await isAuthenticated(platform, cookies);
	if (!authenticated) {
		return redirect(302, '/admin/auth');
	}

	const lastTimeCommentsRead =
		(await platform?.env.KV.get<number>('lastTimeCommentsRead', { type: 'json' })) ?? 0;
	await platform?.env.KV.put('lastTimeCommentsRead', Date.now().toString());

	const { getSignedUrl } = useCloudflareImagesService(platform);
	const db = createDb(platform.env.DB);
	const comments = await getComments(db);
	const commentsWithImages = await Promise.all(
		comments.map(async (c) => ({
			...c,
			imgSrc: await getSignedUrl(c.imageId, 'private400'),
		}))
	);
	return {
		comments: commentsWithImages.map((c) => ({
			...c,
			createdAt: new Date(c.createdAt).toLocaleString(),
			unread: new Date(c.createdAt) > new Date(lastTimeCommentsRead),
			imgSrc: c.imgSrc,
			imageDeleted: c.imgDeleted
		}))
	};
};
