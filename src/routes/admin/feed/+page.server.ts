import {redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isAuthenticated } from '../../../server/auth.service';
import { createDb } from '../../../server/db/client';
import { getComments, getNewCommentCountSince } from '../../../server/comments.service';
import { useCloudflareImagesService } from '../../../server/cloudflare.service';

export const load: PageServerLoad = async ({platform, cookies}) => {
  if(!platform) {
    throw new Error('Platform not available');
  }
  const authenticated = await isAuthenticated(platform, cookies)
  if (!authenticated) {
    return redirect(302, '/admin/auth');
  }

  const lastTimeCommentsRead = await platform?.env.KV.get<number>('lastTimeCommentsRead', { type: 'json' }) ?? 0;
  await platform?.env.KV.put('lastTimeCommentsRead', Date.now().toString());

  const { getSignedUrl } = useCloudflareImagesService(platform);
  const comments = await getComments(
    createDb(platform.env.DB)
  );
  const commentsWithImages = await Promise.all(comments.map(async (c) => ({
    ...c,
    imgSrc: await getSignedUrl(c.imageId, 'private400'),
  })));
  return {
    comments: commentsWithImages.map(c => ({
      ...c,
      createdAt: new Date(c.createdAt).toLocaleString(),
      unread: new Date(c.createdAt) > new Date(lastTimeCommentsRead),
      imgSrc: c.imgSrc,
    })),
  };
};