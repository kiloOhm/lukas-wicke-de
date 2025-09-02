import type { PageServerLoad } from './$types';
import { isAuthenticated } from '../server/auth.service';

export const load: PageServerLoad = async ({platform, cookies}) => {
  if(!platform) {
    throw new Error('Platform not available');
  }
  const authenticated = await isAuthenticated(platform, cookies)

  return {
    authenticated
  };
};