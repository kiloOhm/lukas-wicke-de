import { json, error } from '@sveltejs/kit';
import { validateRequest } from '../common';
import { createDb, schema } from '../../../../server/db/client';
import { getCollectionByName } from '../../../../server/collections.service';

type Part = { partNumber: number; etag: string };

export const POST = async (event) => {
	const { collection, platform } = await validateRequest(event);

	const fd = await event.request.formData();
	const key = fd.get('key');
	const uploadId = fd.get('uploadId');
	const filename = fd.get('filename');
	const partsJson = fd.get('parts');

	if (typeof key !== 'string' || typeof uploadId !== 'string' || typeof filename !== 'string') {
		throw error(400, 'key, uploadId, filename required');
	}
	if (typeof partsJson !== 'string') {
		throw error(400, 'parts required');
	}

	let parts: Part[];
	try {
		parts = JSON.parse(partsJson) as Part[];
	} catch {
		throw error(400, 'parts must be valid JSON');
	}

	if (!Array.isArray(parts) || parts.length === 0) {
		throw error(400, 'parts empty');
	}

	// Ensure sorted, unique partNumbers
	parts.sort((a, b) => a.partNumber - b.partNumber);
	for (let i = 0; i < parts.length; i++) {
		const p = parts[i];
		if (!Number.isInteger(p.partNumber) || p.partNumber < 1) throw error(400, 'bad partNumber');
		if (typeof p.etag !== 'string' || p.etag.length === 0) throw error(400, 'bad etag');
		if (i > 0 && parts[i - 1].partNumber === p.partNumber) throw error(400, 'duplicate partNumber');
	}

	const bucket = platform.env.OBJ_STORAGE;
	const mpu = bucket.resumeMultipartUpload(key, uploadId);

	await mpu.complete(parts);

	// Insert DB record
	const db = createDb(platform.env.DB);
	await db.insert(schema.extraFiles).values({
		id: key,
		collection: collection.name,
		name: filename
	});

	// Return updated collection
	const updated = await getCollectionByName(db, collection.name);
	if (!updated) throw error(500, 'collection missing after update');

	return json(updated);
};
