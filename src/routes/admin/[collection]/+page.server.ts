import { error, redirect, type Actions, type RequestEvent } from '@sveltejs/kit';
import { isAuthenticated } from '../../../server/auth.service';
import type { PageServerLoad } from './$types';
import type { CollectionInfo, ImageInfo } from '../../../types';
import { useCloudflareImagesService } from '../../../server/cloudflare.service';
import type { GalleryItemInfo } from '../../../types';

export const load: PageServerLoad = async (event) => {
  const {collection, platform} = await validateRequest(event);
  const { getSignedUrl } = useCloudflareImagesService(platform!);
  return { 
    collection,
    images: await Promise.all(collection.images.map(async (img) => ({
      src: (await getSignedUrl(img.id, 'private1440')).href,
      alt: img.alt,
      id: img.id
    } as GalleryItemInfo)))
  };
};

export const actions = {
  async updateSettings(event) {
    const { request } = event;
    const {collection, collections, platform} = await validateRequest(event);
    const fd = await request.formData();
    const name = fd.get('name');
    const nameStr = name instanceof Blob ? await name.text() : name;
    if(nameStr === null) {
      return error(400, "Name is required");
    }
    const password = fd.get('password');
    const passwordStr = (password instanceof Blob ? await password.text() : password);
    collection.name = nameStr;
    collection.password = passwordStr ?? undefined;
    collections.splice(collections.findIndex(c => c.name === collection.name), 1, collection);
    await platform?.env.KV.put('collections', JSON.stringify(collections));
  },
  async upload(event) {
    const {request} = event;
    const {collection, collections, platform} = await validateRequest(event);
    const { uploadImage, getBatchToken } = useCloudflareImagesService(platform);
    const fd = await request.formData();
    const files = fd.getAll('files');
    if(!files?.length) {
      return error(400, "Files are required");
    }
    const batchToken = files.length === 1 ? undefined : (await getBatchToken()).token;
    const uploadResults = await Promise.allSettled(files.filter(f => f instanceof File).map(f => uploadImage(f, batchToken)));
    const uploaded: number = uploadResults.filter(r => r.status === 'fulfilled').length;
    const errors: string[] = [];
    if(uploadResults.some(r => r.status === 'rejected')) {
      errors.push(...uploadResults.filter(r => r.status === 'rejected').map(r => r.reason instanceof Error ? r.reason.message : 'Unknown error'));
    }
    collection.images.push(...(uploadResults.map(r => r.status === 'fulfilled' ? { id: r.value.id, alt: r.value.id } : null).filter(Boolean) as ImageInfo[]));
    collections.splice(collections.findIndex(c => c.name === collection.name), 1, collection);
    await platform?.env.KV.put('collections', JSON.stringify(collections));
    if (errors.length) {
      return {
        uploaded,
        errors
      }
    }
  },
  async delete(event) {
    const { request } = event;
    const { collection, collections, platform } = await validateRequest(event);
    const fd = await request.formData();
    const id = fd.get('id');
    if (typeof id !== 'string') {
      return error(400, "Image ID is required");
    }
    const { deleteImage } = useCloudflareImagesService(platform);
    try {
      await deleteImage(id);
    } catch {}
    collection.images = collection.images.filter(img => img.id !== id);
    collections.splice(collections.findIndex(c => c.name === collection.name), 1, collection);
    await platform?.env.KV.put('collections', JSON.stringify(collections));
  },
  async deleteCollection(event) {
    let { collection, collections, platform } = await validateRequest(event);
    collections = collections.filter(c => c.name !== collection.name);
    await platform?.env.KV.put('collections', JSON.stringify(collections));
    return redirect(302, '/admin');
  }
} satisfies Actions;

//#region helpers

async function validateRequest({ platform, cookies, params }: RequestEvent<{
    collection?: string;
}>) {
      if(!platform) {
      throw new Error('Platform not available');
    }
    if(!params.collection) {
      throw new Error('Collection not specified');
    }
    const authenticated = await isAuthenticated(platform, cookies);
    if (!authenticated) {
      return redirect(302, '/admin/auth');
    }
    const collections = await platform?.env.KV.get<CollectionInfo[]>('collections', { type: 'json' }) ?? [];
    const collection = collections.find(c => c.name.toLowerCase() === params.collection!.toLowerCase());
    if (!collection) {
      return error(404, 'Collection not found');
    }
    return { collections, collection, platform };
}

//#endregion helpers