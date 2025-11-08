import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { CollectionInfo, GalleryItemInfo } from '../../../types';
import { useCloudflareImagesService } from '../../../server/cloudflare.service';
import { createDb } from '../../../server/db/client';
import { getCommentCountsForCollection } from '../../../server/comments.service';

export const load: PageServerLoad = async ({ url, platform, params, cookies }) => {
	if (!platform) {
		return error(500, 'Platform not available');
	}
	const collections = await platform.env.KV.get<CollectionInfo[]>('collections', { type: 'json' });
	const collection = collections?.find(
		(c) => c.name.toLowerCase() === params.collection.toLowerCase()
	);
	if (!collection) {
		return error(404, 'Collection not found');
	}
	const providedAuth = url.searchParams.get('k');
	const cookieAuth = cookies.get('auth_' + collection.name);
	const authorized = providedAuth === collection.password || cookieAuth === collection.password;
	if (!authorized) {
		return redirect(302, '/c/' + collection.name + '/auth');
	}
	const { getSignedUrl } = useCloudflareImagesService(platform);

	const images: (GalleryItemInfo & {
		src400: string;
		src800: string;
		src1440: string;
		src4k: string;
		src8k: string;
	})[] =
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
		authorized,
		name: collection.name,
		images,
		commentCounts
	};
};
