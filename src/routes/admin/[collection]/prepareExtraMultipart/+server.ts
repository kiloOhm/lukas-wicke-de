import { json, error } from '@sveltejs/kit';
import { validateRequest } from '../common';

const PART_SIZE = 10 * 1024 * 1024; // 10 MiB (must be >= 5 MiB and consistent)

function sanitizeFilename(name: string): string {
	// keep your original for display, but make key safe-ish
	return name.replace(/[^\w.\- ()]+/g, '_');
}

export const POST = async (event) => {
	const { collection, platform } = await validateRequest(event);

	const fd = await event.request.formData();
	const filename = fd.get('filename');
	const size = fd.get('size');
	const contentType = fd.get('contentType');

	if (typeof filename !== 'string' || filename.length === 0) {
		throw error(400, 'filename required');
	}
	if (typeof size !== 'string' || !/^\d+$/.test(size)) {
		throw error(400, 'size required');
	}

	const totalSize = Number(size);
	if (!Number.isFinite(totalSize) || totalSize <= 0) {
		throw error(400, 'invalid size');
	}

	// R2 max parts is 10,000 (S3 rule; R2 follows S3 multipart constraints)
	const maxParts = 10000;
	const numParts = Math.ceil(totalSize / PART_SIZE);
	if (numParts > maxParts) {
		throw error(400, `file too large (would require ${numParts} parts)`);
	}

	const safeName = sanitizeFilename(filename);
	const objectKey = `${collection.name}/extra/${safeName}-${crypto.randomUUID()}`;

	const bucket = platform.env.OBJ_STORAGE;

	const mpu = await bucket.createMultipartUpload(objectKey, {
		httpMetadata: {
			contentType:
				typeof contentType === 'string' && contentType.length > 0
					? contentType
					: 'application/octet-stream'
		}
	});

	return json({
		key: objectKey,
		uploadId: mpu.uploadId,
		partSize: PART_SIZE
	});
};
