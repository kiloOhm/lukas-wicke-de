import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { CollectionInfo } from '../../../types';

export const load: PageServerLoad = async ({url, platform, params, cookies}) => {
  const collection = await platform?.env.KV.get<CollectionInfo>('c:' + params.collection, { type: 'json' });
  if(!collection) {
    return error(404, "Collection not found")
  }
  const providedAuth = url.searchParams.get('k');
  const cookieAuth = cookies.get('auth:' + params.collection);
  const authorized = providedAuth === collection.password || cookieAuth === collection.password;
  if (!authorized) {
    return redirect(302, '/c/' + params.collection + '/auth');
  }
	return {
    authorized,
    name: collection.name,
		images: collection.images ?? [],
	};
};