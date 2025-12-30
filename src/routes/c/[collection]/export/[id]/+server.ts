import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { useCloudflareImagesService } from '../../../../../server/cloudflare.service';
import { getCollectionByName } from '../../../../../server/collections.service';
import { createDb } from '../../../../../server/db/client';

export const GET: RequestHandler = async ({ params, cookies, platform, url }) => {
  if (!platform) {
    return error(500, "Platform not available");
  }
  const collection = await getCollectionByName(createDb(platform.env.DB), params.collection!);
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