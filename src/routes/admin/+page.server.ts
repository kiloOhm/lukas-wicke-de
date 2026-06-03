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

	const MIGRATION_CAP = 20;
	const migrated: { id: string; fileName: string }[] = [];
	outer: for (const collection of collections) {
		for (const img of collection.images) {
			if (img.fileName && img.fileName.trim() !== '') continue;
			const details = await getImageDetails(img.id).catch(() => null);
			img.fileName = details?.filename ?? img.id;
			migrated.push({ id: img.id, fileName: img.fileName });
			if (migrated.length >= MIGRATION_CAP) break outer;
		}
	}
	if (migrated.length > 0) {
		const db = createDb(platform.env.DB);
		for (const { id, fileName } of migrated) {
			await db.update(images).set({ fileName }).where(eq(images.id, id));
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
