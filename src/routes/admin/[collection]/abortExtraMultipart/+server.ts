import { json, error } from '@sveltejs/kit';
import { validateRequest } from '../common';

export const POST = async (event) => {
	const { platform } = await validateRequest(event);

	const fd = await event.request.formData();
	const key = fd.get('key');
	const uploadId = fd.get('uploadId');

	if (typeof key !== 'string' || key.length === 0) {
		throw error(400, 'key is required');
	}
	if (typeof uploadId !== 'string' || uploadId.length === 0) {
		throw error(400, 'uploadId is required');
	}

	const bucket = platform.env.OBJ_STORAGE;

	// Best-effort abort: if it was already completed/aborted, swallow “not found” style failures.
	try {
		const mpu = bucket.resumeMultipartUpload(key, uploadId);
		await mpu.abort();
	} catch {
		// ignore
	}

	return json({ ok: true });
};
