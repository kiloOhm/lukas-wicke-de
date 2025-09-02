import type { Cookies } from "@sveltejs/kit";

export async function isAuthenticated(platform: Readonly<App.Platform>, cookies: Cookies) {
  const kvAuth = await platform?.env.KV.get<string[]>('auth', { type: 'json' });
  const cookieAuth = cookies.get('auth');
  return kvAuth?.includes(cookieAuth ?? '') ?? false;
}
