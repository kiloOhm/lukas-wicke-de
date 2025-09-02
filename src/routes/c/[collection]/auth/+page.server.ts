import { error, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { CollectionInfo } from '../../../../types';


export const actions = {
  auth: async ({request, cookies, platform, params}) => {
    const collection = await platform?.env.KV.get<CollectionInfo>('c:' + params.collection, { type: 'json' });
    if(!collection) {
      return error(404, "Collection not found")
    }
    const cookieAuth = cookies.get('auth');
    const authenticated = collection?.password === cookieAuth;
    if (authenticated) {
      return redirect(302, '/c/' + collection.name);
    }
    const data = await request.formData();
    const password = data.get('password');
    const passwordString = password instanceof Blob ? await password.text() : password;
    if(!passwordString) {
      throw new Error('No password provided');
    }
    if (collection?.password === passwordString) {
      cookies.set('auth:' + params.collection, passwordString, {
        path: '/c/' + collection.name,
      });
      return redirect(302, '/c/' + collection.name);
    }
    return error(401, 'Invalid password');
  }
} satisfies Actions