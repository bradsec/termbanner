import { validateFonts } from '../../src/font.js';
import { handleApi } from '../../src/api-handler.js';

async function fetchJson(env, request, path) {
  const url = new URL(path.replace(/^\.\//, '/'), request.url);
  const res = await env.ASSETS.fetch(new Request(url, { method: 'GET' }));
  if (!res.ok) {
    throw new Error(`failed to load ${path}: ${res.status}`);
  }
  return res.json();
}

function makeLoaders(env, request) {
  let indexesPromise;
  return {
    async indexes() {
      if (!indexesPromise) {
        indexesPromise = (async () => {
          const [ansiRaw, flf, tdf] = await Promise.all([
            fetchJson(env, request, '/fonts/ansi-fonts.json'),
            fetchJson(env, request, '/fonts/flf/index.json'),
            fetchJson(env, request, '/fonts/tdf/index.json'),
          ]);
          return { ansi: validateFonts(ansiRaw), flf, tdf };
        })();
      }
      return indexesPromise;
    },
    async loadFont(descriptor) {
      if (descriptor.source === 'ansi') {
        return descriptor.font;
      }
      return fetchJson(env, request, descriptor.path);
    },
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed\n', {
      status: 405,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET' },
    });
  }
  const url = new URL(request.url);
  const accept = request.headers.get('Accept') ?? '';
  try {
    const result = await handleApi(url.searchParams.toString(), accept, makeLoaders(env, request));
    return new Response(result.body, { status: result.status, headers: result.headers });
  } catch (e) {
    return new Response('Internal Server Error\n', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
