import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';


export const actions = {
  login: async ({request, cookies, platform}) => {
    if(import.meta.env.DEV) {
      platform?.env.KV.put('auth', JSON.stringify(['dev-password']));
    }
    const data = await request.formData();
    const password = data.get('password');
    const passwordString = password instanceof Blob ? await password.text() : password;
    if(!passwordString) {
      throw new Error('No password provided');
    }
    const kv = await platform?.env.KV.get<string[]>('auth', { type: 'json' });
    if (kv?.includes(passwordString ?? '') ?? false) {
      cookies.set('auth', passwordString, {
        path: '/admin',
      });
      return redirect(302, '/admin');
    }
    return { success: false };
  }
} satisfies Actions