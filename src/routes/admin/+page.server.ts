import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { CollectionInfo } from '../../types';
import { isAuthenticated } from '../../server/auth.service';
import { useCloudflareImagesService } from '../../server/cloudflare.service';

export const load: PageServerLoad = async ({platform, cookies}) => {
  if(!platform) {
    throw new Error('Platform not available');
  }
  const authenticated = await isAuthenticated(platform, cookies)
  if (!authenticated) {
    return redirect(302, '/admin/auth');
  }
  let collections = await platform?.env.KV.get<CollectionInfo[]>('collections', { type: 'json' });
  if(collections === null || collections === undefined) {
    await platform?.env.KV.put('collections', "[]");
    collections = [];
  }
  const { getSignedUrl } = useCloudflareImagesService(platform);
  for(const collection of collections) {
    if(collection.images.length > 0) {
      collection.thumb = (await getSignedUrl(collection.images[0].id, 'thumb')).href;
    }
  }
  return {
    collections
  };
};
  
export const actions = {
  async addCollection({platform, cookies, request}) {
    if(!platform) {
      throw new Error('Platform not available');
    }
    const authenticated = await isAuthenticated(platform, cookies)
    if(!authenticated) {
      return error(403);
    }
    const fd = await request.formData();
    const name = fd.get('name');
    const nameStr = name instanceof Blob ? await name.text() : name;
    if(nameStr === null) {
      return error(400, "Name is required");
    }
    const collections = await platform?.env.KV.get<CollectionInfo[]>('collections', { type: 'json' }) ?? [];
    if(collections.find(c => c.name.toLowerCase() === nameStr.toLowerCase())) {
      return error(400, "Collection already exists");
    }
    collections.push({ name: nameStr, images: [] });
    await platform?.env.KV.put('collections', JSON.stringify(collections));
    return collections;
  }
} satisfies Actions;