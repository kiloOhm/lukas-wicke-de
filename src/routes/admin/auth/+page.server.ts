import { error, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';


export const actions = {
  auth: async ({request, cookies, platform}) => {
    if(import.meta.env.DEV) {
      platform?.env.KV.put('auth', JSON.stringify(['dev-password']));
    }
    const kvAuth = await platform?.env.KV.get<string[]>('auth', { type: 'json' });
    const cookieAuth = cookies.get('auth');
    const authenticated = kvAuth?.includes(cookieAuth ?? '') ?? false;
    if (authenticated) {
      return redirect(302, '/admin');
    }
    const data = await request.formData();
    const password = data.get('password');
    const passwordString = password instanceof Blob ? await password.text() : password;
    if(!passwordString) {
      throw new Error('No password provided');
    }
    if (kvAuth?.includes(passwordString ?? '') ?? false) {
      cookies.set('auth', passwordString, {
        path: '/admin',
      });
      return redirect(302, '/admin');
    }
    return error(401, 'Invalid password');
  }
} satisfies Actions