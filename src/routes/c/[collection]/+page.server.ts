import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({url, platform, params}) => {
  const kv = await platform?.env.KV.get<{key: string, images?: string[][], archive?: string}>(params.collection);
  const providedKey = url.searchParams.get('k');
	return {
    validKey: providedKey === kv?.key,  
		images: kv?.images ?? [],
    archiveDownloadUrl: kv?.archive
	};
};