import { validateFonts } from '../../src/font.js';
import { listFontNames } from '../../src/resolve-font.js';

async function fetchJson(env, request, path) {
  const url = new URL(path.replace(/^\.\//, '/'), request.url);
  const res = await env.ASSETS.fetch(new Request(url, { method: 'GET' }));
  if (!res.ok) throw new Error(`failed to load ${path}: ${res.status}`);
  return res.json();
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed\n', {
      status: 405,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET' },
    });
  }
  try {
    const [ansiRaw, flf, tdf] = await Promise.all([
      fetchJson(env, request, '/fonts/ansi-fonts.json'),
      fetchJson(env, request, '/fonts/flf/index.json'),
      fetchJson(env, request, '/fonts/tdf/index.json'),
    ]);
    const names = listFontNames({ ansi: validateFonts(ansiRaw), flf, tdf });
    return new Response(`${names.join('\n')}\n`, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e) {
    return new Response('Internal Server Error\n', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
