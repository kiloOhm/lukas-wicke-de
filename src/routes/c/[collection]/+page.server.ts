import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { CollectionInfo, GalleryItemInfo } from '../../../types';
import { useCloudflareImagesService } from '../../../server/cloudflare.service';

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

	return {
		authorized,
		name: collection.name,
		images:
			(await Promise.all(
				collection.images.map(
					async (image) =>
						({
							alt: image.alt,
							src: (await getSignedUrl(image.id, 'private1440')).href,
							id: image.id,
							width: image.width,
							height: image.height
						}) as GalleryItemInfo
				)
			)) ?? []
	};
};
