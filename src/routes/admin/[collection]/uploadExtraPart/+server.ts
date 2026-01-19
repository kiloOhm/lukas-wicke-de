import { json, error } from '@sveltejs/kit';
import { validateRequest } from '../common';

const MIN_PART = 5 * 1024 * 1024; // 5 MiB

export const POST = async (event) => {
	const { platform } = await validateRequest(event);

	const url = new URL(event.request.url);
	const key = url.searchParams.get('key');
	const uploadId = url.searchParams.get('uploadId');
	const partNumberStr = url.searchParams.get('partNumber');
	const isLast = url.searchParams.get('isLast') === 'true';

	if (!key || !uploadId || !partNumberStr)
		throw error(400, 'key, uploadId, partNumber are required');

	const partNumber = Number(partNumberStr);
	if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000)
		throw error(400, 'invalid partNumber');

	const lenHeader = event.request.headers.get('content-length');
	const contentLength = lenHeader ? Number(lenHeader) : NaN;
	if (!Number.isFinite(contentLength) || contentLength <= 0)
		throw error(400, 'missing/invalid content-length');

	if (!isLast && contentLength < MIN_PART)
		throw error(400, 'part too small (min 5MiB unless last)');

	const bucket = platform.env.OBJ_STORAGE;
	const mpu = bucket.resumeMultipartUpload(key, uploadId);

	const body = event.request.body;
	if (!body) throw error(400, 'missing request body');

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const FixedLengthStreamCtor = (globalThis as any).FixedLengthStream;

	// Preferred: stream with known length
	if (typeof FixedLengthStreamCtor === 'function') {
		const { readable, writable } = new FixedLengthStreamCtor(contentLength);

		// Start piping and uploading concurrently
		const pump = body.pipeTo(writable);
		const uploadedPromise = mpu.uploadPart(partNumber, readable);

		const [uploaded] = await Promise.all([uploadedPromise, pump]);
		return json({ etag: uploaded.etag });
	}
	// Fallback (e.g. non-Workers dev env): buffer
	console.log('no FixedLengthStreamCtor available, falling back to arrayBuffer()');
	const ab = await event.request.arrayBuffer();
	if (ab.byteLength === 0) throw error(400, 'empty part');

	const uploaded = await mpu.uploadPart(partNumber, ab);
	return json({ etag: uploaded.etag });
};
