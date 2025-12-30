import { error, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { GalleryImage, ImageInfo } from '../../../types';
import { useCloudflareImagesService } from '../../../server/cloudflare.service';
import type { GalleryItemInfo } from '../../../types';
import { validateRequest } from './common';
import { createDb } from '../../../server/db/client';
import { getCommentCountsForCollection } from '../../../server/comments.service';
import { deleteCollection, deleteImageFromCollection, updateCollection } from '../../../server/collections.service';

export const load: PageServerLoad = async (event) => {
	const { collection, platform } = await validateRequest(event);
	const { getSignedUrl } = useCloudflareImagesService(platform!);

	const images: GalleryImage[] =
		(await Promise.all(
			collection.images.map(async (image) => {
				const [url400, url800, url1440, url4k, url8k] = await Promise.all([
					getSignedUrl(image.id, 'private400'),
					getSignedUrl(image.id, 'private800'),
					getSignedUrl(image.id, 'private1440'),
					getSignedUrl(image.id, 'private4k'),
					getSignedUrl(image.id, 'private8k')
				]);

				return {
					alt: image.alt,
					src: url1440.href,
					id: image.id,
					width: image.width,
					height: image.height,
					src400: url400.href,
					src800: url800.href,
					src1440: url1440.href,
					src4k: url4k.href,
					src8k: url8k.href
				} as GalleryItemInfo & {
					src400: string;
					src800: string;
					src1440: string;
					src4k: string;
					src8k: string;
				};
			})
		)) ?? [];

		const db = createDb(platform.env.DB);
		const commentCounts = await getCommentCountsForCollection(db, collection.name);

	return {
		collection,
		images,
		commentCounts
	};
};

export const actions = {
	async updateSettings(event) {
		const { request } = event;
		const { collection, platform } = await validateRequest(event);
		const originalName = collection.name;
		const fd = await request.formData();
		const name = fd.get('name');
		const nameStr = name instanceof Blob ? await name.text() : name;
		if (nameStr === null) {
			return error(400, 'Name is required');
		}
		const password = fd.get('password');
		const passwordStr = password instanceof Blob ? await password.text() : password;
		collection.name = nameStr;
		collection.password = passwordStr ?? undefined;
		await updateCollection(createDb(platform.env.DB), originalName, collection);
	},
	async delete(event) {
		const { request } = event;
		const { collection, platform } = await validateRequest(event);
		const fd = await request.formData();
		const id = fd.get('id');
		if (typeof id !== 'string') {
			return error(400, 'Image ID is required');
		}
		const { deleteImage } = useCloudflareImagesService(platform);
		try {
			await deleteImage(id);
		} catch {
			// ignore
		}
		await deleteImageFromCollection(createDb(platform.env.DB), collection.name, id);
	},
	async deleteCollection(event) {
		const { collection, platform } = await validateRequest(event);
		const { deleteImage, getBatchToken } = useCloudflareImagesService(platform);
		const batchToken = (await getBatchToken()).token;
		const ids = collection.images.map((img) => img.id);
		const CONCURRENCY = 5;
		let idx = 0;
		const failed: string[] = [];
		// worker pool
		const worker = async () => {
			while (idx < ids.length) {
				const current = ids[idx++];
				try {
					await deleteImage(current, batchToken);
				} catch {
					failed.push(current);
				}
			}
		};
		const workers: Promise<void>[] = [];
		for (let i = 0; i < Math.min(CONCURRENCY, ids.length); i++) {
			workers.push(worker());
		}
		await Promise.all(workers);

		console.log(`Failed to delete ${failed.length} images.`);

		await deleteCollection(createDb(platform.env.DB), collection.name);
		return redirect(302, '/admin');
	}
} satisfies Actions;
