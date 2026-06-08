import { json } from '@sveltejs/kit';
import { validateRequest } from '../common';
import type { ImageInfo } from '../../../../types';
import { addImagesToCollection } from '../../../../server/collections.service';
import { createDb } from '../../../../server/db/client';

export const POST = async (event) => {
  const { collection, platform } = await validateRequest(event);
  const fd = await event.request.formData();

  let items: Array<{ id: string; fileName: string; width?: number; height?: number }> = [];
  const itemsRaw = fd.get('items');
  if (typeof itemsRaw === 'string') {
    try { items = JSON.parse(itemsRaw); } catch {}
  }

  // Back-compat: allow plain ids array too
  const idsRaw = fd.get('ids');
  const ids: string[] = typeof idsRaw === 'string' ? JSON.parse(idsRaw) : [];

  const toSave: ImageInfo[] = (items.length ? items.map(i => {
    const fileName = i.fileName?.trim() || i.id;
    return {
      id: i.id,
      fileName,
      alt: fileName,
      width: i.width ?? 0,
      height: i.height ?? 0
    };
  }) : ids.map(id => ({ id, fileName: id, alt: id, width: 0, height: 0 })));

  await addImagesToCollection(
    createDb(platform.env.DB),
    collection.name,
    toSave
  );

  return json({ saved: toSave.length });
};