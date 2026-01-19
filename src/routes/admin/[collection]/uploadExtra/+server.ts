import { json } from '@sveltejs/kit';
import { validateRequest } from '../common';
import { uploadExtraFile } from '../../../../server/collections.service';
import { createDb } from '../../../../server/db/client';
import type { CollectionInfo } from '../../../../types';

export const POST = async (event) => {
	const { collection, platform } = await validateRequest(event);
	const fd = await event.request.formData();

	const file = fd.get('file');

	if (!(file instanceof File)) {
		return json({ error: 'No file field provided' }, { status: 400 });
	}

	const db = createDb(platform.env.DB);
	const bucket = platform.env.OBJ_STORAGE;

	const newId = await uploadExtraFile(db, bucket, collection.name, file);

	return json({
		...collection,
		extraFiles: [...(collection.extraFiles || []), { name: file.name, id: newId }]
	} as CollectionInfo);
};
