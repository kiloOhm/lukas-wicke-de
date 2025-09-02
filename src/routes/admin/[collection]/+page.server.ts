import { error, redirect, type Actions, type RequestEvent } from '@sveltejs/kit';
import { isAuthenticated } from '../../../server/auth.service';
import type { PageServerLoad } from './$types';
import type { CollectionInfo } from '../../../types';
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
    const { uploadImage } = useCloudflareImagesService(platform);
    const fd = await request.formData();
    const file = fd.get('file');
    if (!(file instanceof Blob)) {
      return error(400, "File is required");
    }
    const [uploadResult, aiResult] = await Promise.allSettled([
      uploadImage(file),
      (platform.env.AI?.run('@cf/microsoft/resnet-50', {
        image: [...await file.bytes()]
      }) ?? Promise.resolve(null))
    ]);
    if(uploadResult.status === 'rejected') {
      return error(500, uploadResult.reason instanceof Error ? uploadResult.reason.message : 'Unknown error');
    }
    let alt = "";
    if(aiResult.status === 'fulfilled') {
      alt = aiResult.value[0].label?.toLocaleLowerCase() ?? "";
    }
    collection.images.push({ id: uploadResult.value.id, alt });
    collections.splice(collections.findIndex(c => c.name === collection.name), 1, collection);
    await platform?.env.KV.put('collections', JSON.stringify(collections));
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
    await deleteImage(id);
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