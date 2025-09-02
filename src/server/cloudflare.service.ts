export function useCloudflareImagesService(platform: Readonly<App.Platform>) {
  return {
    async getSignedUrl(imgId: string, variant: 'private4k' | 'public' | 'thumb' | 'private1440') {
      const accountHash = platform.env.CF_IMAGES_ACCOUNT_HASH ?? import.meta.env.CF_IMAGES_ACCOUNT_HASH;
      const apiKey = platform.env.CF_IMAGES_API_TOKEN ?? import.meta.env.CF_IMAGES_API_TOKEN;
      if (!apiKey) {
        throw new Error('Missing Cloudflare Images API token');
      }
      return await generateSignedUrl(new URL(`https://imagedelivery.net/${accountHash}/${imgId}/${variant}`), apiKey);
    },
    async uploadImage(file: File) {
      const accountId = platform.env.CF_IMAGES_ACCOUNT_ID;
      if (!accountId) {
        throw new Error('Missing Cloudflare Images account ID');
      }
      const apiKey = platform.env.CF_API_TOKEN ?? import.meta.env.CF_API_TOKEN;
      if (!apiKey) {
        throw new Error('Missing Cloudflare Images API token');
      }
      const API_URL = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`;
      const TOKEN = apiKey;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('requireSignedURLs', 'true');
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
        },
        body: formData,
      });
      if (!res.ok) {
        throw new Error('Failed to upload image: ' + await res.text());
      }
      const data = await res.json() as {
        result: {
          id: string,
        }
      };
      return data.result;
    },
    async deleteImage(id: string) {
      const accountId = platform.env.CF_IMAGES_ACCOUNT_ID;
      if (!accountId) {
        throw new Error('Missing Cloudflare Images account ID');
      }
      const apiKey = platform.env.CF_API_TOKEN ?? import.meta.env.CF_API_TOKEN;
      if (!apiKey) {
        throw new Error('Missing Cloudflare Images API token');
      }
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      if (!res.ok) {
        throw new Error('Failed to delete image: ' + await res.text());
      }
    },
    async getDirectUploadUrl() {
      const accountId = platform.env.CF_IMAGES_ACCOUNT_ID;
      if (!accountId) {
        throw new Error('Missing Cloudflare Images account ID');
      }
      const apiKey = platform.env.CF_IMAGES_API_TOKEN ?? import.meta.env.CF_IMAGES_API_TOKEN;
      if (!apiKey) {
        throw new Error('Missing Cloudflare Images API token');
      }
      const fd = new FormData();
      fd.append('requireSignedURLs', 'true');
      fd.append('metadata', JSON.stringify({ key: 'value' }));
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: fd
      });
      if(!res.ok) {
        throw new Error('Failed to get direct upload URL');
      }
      const data = await res.json() as {
        result: {
          id: string;
          uploadURL: string;
        };
      };
      return data.result;
    }
  }
}

//#region helpers

const bufferToHex = (buffer: any) =>
  [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');

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