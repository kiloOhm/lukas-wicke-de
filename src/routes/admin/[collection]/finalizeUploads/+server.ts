import { json } from '@sveltejs/kit';
import { validateRequest } from '../common';
import type { ImageInfo } from '../../../../types';
import { useCloudflareImagesService } from '../../../../server/cloudflare.service';

export const POST = async (event) => {
  const { collections, collection, platform } = await validateRequest(event);
  const fd = await event.request.formData();

  let items: Array<{ id: string; width?: number; height?: number }> = [];
  const itemsRaw = fd.get('items');
  if (typeof itemsRaw === 'string') {
    try { items = JSON.parse(itemsRaw); } catch {}
  }

  // Back-compat: allow plain ids array too
  const idsRaw = fd.get('ids');
  const ids: string[] = typeof idsRaw === 'string' ? JSON.parse(idsRaw) : [];

  const toSave: ImageInfo[] = (items.length ? items.map(i => ({
    id: i.id, alt: i.id, width: i.width ?? 0, height: i.height ?? 0
  })) : ids.map(id => ({ id, alt: id, width: 0, height: 0 })));

  collection.images.push(...toSave);
  collections.splice(collections.findIndex(c => c.name === collection.name), 1, collection);
  await platform?.env.KV.put('collections', JSON.stringify(collections));

  return json({ saved: toSave.length });
};