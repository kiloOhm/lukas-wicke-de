import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { CollectionInfo } from '../../types';
import { isAuthenticated } from '../../server/auth.service';
import { useCloudflareImagesService } from '../../server/cloudflare.service';
import { createDb } from '../../server/db/client';
import { createCollection, getCollections } from '../../server/collections.service';
import { getNewCommentCountSince } from '../../server/comments.service';
import { images } from '../../server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ platform, cookies }) => {
	if (!platform) {
		throw new Error('Platform not available');
	}
	const authenticated = await isAuthenticated(platform, cookies);
	if (!authenticated) {
		return redirect(302, '/admin/auth');
	}
	const collections = (await getCollections(createDb(platform.env.DB))) ?? [];
	const { getSignedUrl, getImageDetails } = useCloudflareImagesService(platform);
	for (const collection of collections) {
		if (collection.images.length > 0) {
			collection.thumb = (await getSignedUrl(collection.images[0].id, 'thumb')).href;
		}
	}

	// migrate all images
	for (const collection of collections) {
		for (const img of collection.images) {
			if (!img.fileName || img.fileName.trim() === '') {
				const details = await getImageDetails(img.id);
				if (details) {
					img.fileName = details.id;
				} else {
					img.fileName = img.id;
				}
			}
		}
	}
	// check if there are any changes
	let needsUpdate = false;
	for (const collection of collections) {
		for (const img of collection.images) {
			if (!img.fileName || img.fileName.trim() === '') {
				needsUpdate = true;
				break;
			}
		}
		if (needsUpdate) {
			break;
		}
	}
	if (needsUpdate) {
		// update DB with new filenames
		const db = createDb(platform.env.DB);
		for (const collection of collections) {
			for (const img of collection.images) {
				await db
					.update(images)
					.set({ fileName: img.fileName })
					.where(eq(images.id, img.id));
			}
		}
	}

	const lastTimeCommentsRead =
		(await platform?.env.KV.get<number>('lastTimeCommentsRead', { type: 'json' })) ?? 0;
	const newCommentsCount = await getNewCommentCountSince(
		createDb(platform.env.DB),
		lastTimeCommentsRead
	);
	return {
		collections,
		newCommentsCount
	};
};

export const actions = {
	async addCollection({ platform, cookies, request }) {
		if (!platform) {
			throw new Error('Platform not available');
		}
		const authenticated = await isAuthenticated(platform, cookies);
		if (!authenticated) {
			return error(403);
		}
		const fd = await request.formData();
		const name = fd.get('name');
		const nameStr = name instanceof Blob ? await name.text() : name;
		if (nameStr === null) {
			return error(400, 'Name is required');
		}
		const db = createDb(platform.env.DB);
		const collections = await getCollections(db);
		if (collections.find((c) => c.name.toLowerCase() === nameStr.toLowerCase())) {
			return error(400, 'Collection already exists');
		}
		const result = await createCollection(db, {
			name: nameStr
		} as CollectionInfo);
		collections.push(result);
		return collections;
	}
} satisfies Actions;
