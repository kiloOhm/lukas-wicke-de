import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({url, platform, params, cookies}) => {
  const kvAuth = await platform?.env.KV.get<string[]>('auth', { type: 'json' });
  const cookieAuth = cookies.get('auth');
  const authenticated = kvAuth?.includes(cookieAuth ?? '') ?? false;
  if (!authenticated) {
    return redirect(302, '/admin/login');
  }
  return {
  };
};