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
    const collection = collections.find(c => c.name.toLowerCase() === params.collection!.toLowerCase());
    if (!collection) {
      return error(404, 'Collection not found');
    }
    return { collections, collection, platform };
}