import { json } from '@sveltejs/kit';
import { validateRequest } from '../common';
import { useCloudflareImagesService } from '../../../../server/cloudflare.service';

export const POST = async (event) => {
  const { request, platform } = event;
  await validateRequest(event);

  const fd = await request.formData();
  const count = Number(fd.get('count') ?? 0);
  if (!Number.isFinite(count) || count < 1) {
    return json({ message: 'Invalid count' }, { status: 400 });
  }

  const { getDirectUploadUrl } = useCloudflareImagesService(platform!);
  const sessionId = crypto.randomUUID();
  const requestedAt = new Date().toISOString();

  const tickets = await Promise.all(
    Array.from({ length: count }, async () => {
      const { id, uploadURL } = await getDirectUploadUrl();
      return { id, uploadURL };
    })
  );

  return json({ sessionId, requestedAt, tickets });
};
