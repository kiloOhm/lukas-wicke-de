import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { CollectionInfo } from '../../types';

export const load: PageServerLoad = async ({platform, cookies}) => {
  const kvAuth = await platform?.env.KV.get<string[]>('auth', { type: 'json' });
  const cookieAuth = cookies.get('auth');
  const authenticated = kvAuth?.includes(cookieAuth ?? '') ?? false;
  if (!authenticated) {
    return redirect(302, '/admin/auth');
  }
  let collections = await platform?.env.KV.get<CollectionInfo[]>('collections', { type: 'json' });
  if(collections === null || collections === undefined) {
    await platform?.env.KV.put('collections', "[]");
    collections = [];
  }
  return {
    collections
  };
};