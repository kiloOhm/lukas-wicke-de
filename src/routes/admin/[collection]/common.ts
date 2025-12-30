import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { isAuthenticated } from '../../../server/auth.service';
import { getCollectionByName, getCollections } from '../../../server/collections.service';
import { createDb } from '../../../server/db/client';


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
    const collection = await getCollectionByName(createDb(platform.env.DB), params.collection!);
    if (!collection) {
      console.log('Collection not found, params.collection:', params.collection);
      return error(404, 'Collection not found');
    }
    return { collection, platform };
}