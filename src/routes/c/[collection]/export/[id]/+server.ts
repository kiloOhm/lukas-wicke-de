import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { CollectionInfo } from '../../../../../types';
import { useCloudflareImagesService } from '../../../../../server/cloudflare.service';

export const GET: RequestHandler = async ({ params, cookies, platform, url }) => {
  if (!platform) {
    return error(500, "Platform not available");
  }
  const collections = await platform.env.KV.get<CollectionInfo[]>("collections", { type: 'json' });
  const collection = collections?.find(c => c.name.toLowerCase() === params.collection.toLowerCase());
  if (!collection) {
    return error(404, "Collection not found")
  }
  const providedAuth = url.searchParams.get('k');
  const cookieAuth = cookies.get('auth_' + params.collection);
  const authorized = providedAuth === collection.password || cookieAuth === collection.password;
  if (!authorized) {
    return redirect(302, '/c/' + params.collection + '/auth');
  }
  const providedId = params.id;
  if (!providedId) {
    return error(400, "Missing image ID");
  }
  if (collection.images.find(i => i.id === providedId) == null) {
    return error(404, "Image not found");
  }
  const { exportImage } = useCloudflareImagesService(platform);
  return exportImage(providedId);
};