import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { isAuthenticated } from '../../../server/auth.service';
import type { CollectionInfo } from '../../../types';


export async function validateRequest({ platform, cookies, params }: RequestEvent<{
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
    console.log(params.collection!.toLowerCase())
    console.log(collections.map(c => c.name.toLowerCase()))
    const collection = collections.find(c => c.name.toLowerCase().trim() === params.collection!.toLowerCase().trim());
    if (!collection) {
      console.log('Collection not found, params.collection:', params.collection);
      return error(404, 'Collection not found');
    }
    return { collections, collection, platform };
}