export function useCloudflareImagesService(platform: Readonly<App.Platform>) {
	return {
		async getImageDetails(id: string) {
			const accountId = platform.env.CF_IMAGES_ACCOUNT_ID ?? import.meta.env.CF_IMAGES_ACCOUNT_ID;
			if (!accountId) {
				throw new Error('Missing Cloudflare Images account ID');
			}
			const apiKey = platform.env.CF_API_TOKEN ?? import.meta.env.CF_API_TOKEN;
			if (!apiKey) {
				throw new Error('Missing Cloudflare API token');
			}
			const res = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${id}`,
				{ headers: { Authorization: `Bearer ${apiKey}` } }
			);
			if (!res.ok) {
				throw new Error(`CF Images details failed: ${res.status} ${await res.text()}`);
			}
			const json = (await res.json()) as {
				success: boolean;
				result: { id: string; width: number; height: number };
			};
			return json.result;
		},
		async getSignedUrl(
			imgId: string,
			variant:
				| 'private8k'
				| 'private4k'
				| 'public'
				| 'thumb'
				| 'private1440'
				| 'private800'
				| 'private400'
		) {
			const accountHash =
				platform.env.CF_IMAGES_ACCOUNT_HASH ?? import.meta.env.CF_IMAGES_ACCOUNT_HASH;
			const apiKey = platform.env.CF_IMAGES_API_TOKEN ?? import.meta.env.CF_IMAGES_API_TOKEN;
			if (!apiKey) {
				throw new Error('Missing Cloudflare Images API token');
			}
			return await generateSignedUrl(
				new URL(`https://imagedelivery.net/${accountHash}/${imgId}/${variant}`),
				apiKey
			);
		},
		async getBatchToken() {
			const accountId = platform.env.CF_IMAGES_ACCOUNT_ID ?? import.meta.env.CF_IMAGES_ACCOUNT_ID;
			if (!accountId) {
				throw new Error('Missing Cloudflare Images account ID');
			}
			const apiKey = platform.env.CF_API_TOKEN ?? import.meta.env.CF_API_TOKEN;
			if (!apiKey) {
				throw new Error('Missing Cloudflare API token');
			}
			const res = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/batch_token`,
				{
					method: 'GET',
					headers: {
						Authorization: `Bearer ${apiKey}`
					}
				}
			);
			if (!res.ok) {
				throw new Error('Failed to get batch token: ' + (await res.text()));
			}
			const data = (await res.json()) as { result: { token: string; expiresAt: string } };
			return {
				token: data.result.token,
				expiresAt: new Date(data.result.expiresAt)
			};
		},
		async uploadImage(file: File, batchToken?: string) {
			const accountId = platform.env.CF_IMAGES_ACCOUNT_ID;
			if (!accountId) {
				throw new Error('Missing Cloudflare Images account ID');
			}
			const auth = batchToken ?? platform.env.CF_API_TOKEN ?? import.meta.env.CF_API_TOKEN;
			if (!auth) {
				throw new Error('Missing auth');
			}
			const API_URL = batchToken
				? 'https://batch.imagedelivery.net/images/v1'
				: `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`;
			const formData = new FormData();
			formData.append('file', file);
			formData.append('requireSignedURLs', 'true');
			const res = await fetch(API_URL, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${auth}`
				},
				body: formData
			});
			if (!res.ok) {
				throw new Error('Failed to upload image: ' + (await res.text()));
			}
			const data = (await res.json()) as {
				result: {
					id: string;
				};
			};
			return data.result;
		},
		exportImage(id: string) {
			const accountId = platform.env.CF_IMAGES_ACCOUNT_ID ?? import.meta.env.CF_IMAGES_ACCOUNT_ID;
			if (!accountId) {
				throw new Error('Missing Cloudflare Images account ID');
			}
			const apiKey = platform.env.CF_API_TOKEN ?? import.meta.env.CF_API_TOKEN;
			if (!apiKey) {
				throw new Error('Missing Cloudflare Images API token');
			}
			const requestUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${id}/blob`;
			return fetch(requestUrl, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${apiKey}`
				}
			});
		},
		async deleteImage(id: string, batchToken?: string) {
			const accountId = platform.env.CF_IMAGES_ACCOUNT_ID;
			if (!accountId) {
				throw new Error('Missing Cloudflare Images account ID');
			}
			const apiKey = platform.env.CF_API_TOKEN ?? import.meta.env.CF_API_TOKEN;
			if (!apiKey) {
				throw new Error('Missing Cloudflare Images API token');
			}
			if (batchToken) {
				const res = await fetch(`https://batch.imagedelivery.net/images/v1/${id}`, {
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${batchToken}`
					}
				});
				if (!res.ok) {
					throw new Error('Failed to delete image: ' + (await res.text()));
				}
			} else {
				const res = await fetch(
					`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${id}`,
					{
						method: 'DELETE',
						headers: {
							Authorization: `Bearer ${apiKey}`
						}
					}
				);
				if (!res.ok) {
					throw new Error('Failed to delete image: ' + (await res.text()));
				}
			}
		},
		async getDirectUploadUrl() {
			const accountId = platform.env.CF_IMAGES_ACCOUNT_ID;
			if (!accountId) {
				throw new Error('Missing Cloudflare Images account ID');
			}
			// const apiKey = platform.env.CF_IMAGES_API_TOKEN ?? import.meta.env.CF_IMAGES_API_TOKEN;
			const apiKey = platform.env.CF_API_TOKEN ?? import.meta.env.CF_API_TOKEN;
			if (!apiKey) {
				throw new Error('Missing Cloudflare Images API token');
			}
			const fd = new FormData();
			fd.append('requireSignedURLs', 'true');
			fd.append('metadata', JSON.stringify({ key: 'value' }));
			const res = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${apiKey}`
					},
					body: fd
				}
			);
			if (!res.ok) {
				throw new Error('Failed to get direct upload URL: ' + (await res.text()));
			}
			const data = (await res.json()) as {
				result: {
					id: string;
					uploadURL: string;
				};
			};
			return data.result;
		}
	};
}

//#region helpers

const bufferToHex = (buffer: ArrayBuffer) =>
	[...new Uint8Array(buffer)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function generateSignedUrl(url: URL, KEY: string, expirationSeconds: number = 60 * 60 * 24) {
	// `url` is a full imagedelivery.net URL
	// e.g. https://imagedelivery.net/cheeW4oKsx5ljh8e8BoL2A/bc27a117-9509-446b-8c69-c81bfeac0a01/mobile

	const encoder = new TextEncoder();
	const secretKeyData = encoder.encode(KEY);
	const key = await crypto.subtle.importKey(
		'raw',
		secretKeyData,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	// Attach the expiration value to the `url`
	const expiry = Math.floor(Date.now() / 1000) + expirationSeconds;
	url.searchParams.set('exp', expiry.toString());
	// `url` now looks like
	// https://imagedelivery.net/cheeW4oKsx5ljh8e8BoL2A/bc27a117-9509-446b-8c69-c81bfeac0a01/mobile?exp=1631289275

	const stringToSign = url.pathname + '?' + url.searchParams.toString();
	// for example, /cheeW4oKsx5ljh8e8BoL2A/bc27a117-9509-446b-8c69-c81bfeac0a01/mobile?exp=1631289275

	// Generate the signature
	const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
	const sig = bufferToHex(new Uint8Array(mac).buffer);

	// And attach it to the `url`
	url.searchParams.set('sig', sig);

	return url;
}

//#endregion
