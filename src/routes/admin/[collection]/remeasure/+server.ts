// src/routes/admin/[collection]/remeasure/+server.ts
import { json } from '@sveltejs/kit';
import { validateRequest } from '../common';

export const POST = async (event) => {
  const { collection, collections, platform } = await validateRequest(event);

  // Accept FormData with an "items" JSON field (same pattern as finalize)
  const fd = await event.request.formData();
  const raw = fd.get('items');

  if (typeof raw !== 'string') {
    return json({ message: 'Missing items' }, { status: 400 });
  }

  let items: Array<{ id: string; width: number; height: number }>;
  try {
    items = JSON.parse(raw);
  } catch {
    return json({ message: 'Bad JSON' }, { status: 400 });
  }

  // Update in-memory collection
  const byId = new Map(collection.images.map((i) => [i.id, i]));
  let updated = 0;
  let skipped = 0;

  for (const { id, width, height } of items) {
    const img = byId.get(id);
    if (!img) { skipped++; continue; }
    img.width = Number(width) || 0;
    img.height = Number(height) || 0;
    updated++;
  }

  // Persist to KV
  const idx = collections.findIndex((c) => c.name === collection.name);
  if (idx >= 0) {
    collections.splice(idx, 1, collection);
  }
  await platform?.env.KV.put('collections', JSON.stringify(collections));

  return json({ updated, skipped });
};
