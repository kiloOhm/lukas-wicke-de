import { error, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { CollectionInfo } from '../../../../types';
import { getCollectionByName } from '../../../../server/collections.service';
import { createDb } from '../../../../server/db/client';

export const actions = {
  auth: async ({request, cookies, platform, params}) => {
    if(!platform) {
      return error(500, "Platform not available");
    }
    if(!params.collection) {
      return error(400, "Collection not specified");
    }
    const collection = await getCollectionByName(createDb(platform.env.DB), params.collection!);
    if(!collection) {
      return error(404, "Collection not found")
    }
    const data = await request.formData();
    const password = data.get('password');
    const passwordString = password instanceof Blob ? await password.text() : password;
    if(!passwordString) {
      throw new Error('No password provided');
    }
    if (collection?.password === passwordString) {
      cookies.set('auth_' + collection.name, passwordString, {
        path: '/',
      });
      return redirect(302, '/c/' + collection.name.toLowerCase());
    }
    return error(401, 'Invalid password');
  }
} satisfies Actions