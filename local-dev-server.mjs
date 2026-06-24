import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const port = Number(process.env.PORT || 8765);
const host = process.env.HOST || '127.0.0.1';
const staticRoot = path.resolve(process.cwd(), 'outputs');
const cloudOrigin = 'https://ramz-property-system.pages.dev';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);
    if (url.pathname === '/__local_health') {
      return send(response, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true, proxy: cloudOrigin }));
    }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return proxyApi(request, response, url);
    }
    return serveStatic(response, url.pathname);
  } catch (error) {
    console.error(error);
    return send(response, 500, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: 'local_server_error' }));
  }
});

async function proxyApi(request, response, url) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 5 * 1024 * 1024) return send(response, 413, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: 'payload_too_large' }));
    chunks.push(chunk);
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value == null || ['host', 'connection', 'content-length', 'accept-encoding'].includes(key)) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  headers.set('origin', cloudOrigin);

  const method = request.method || 'GET';
  const upstream = await fetch(`${cloudOrigin}${url.pathname}${url.search}`, {
    method,
    headers,
    body: ['GET', 'HEAD'].includes(method) ? undefined : Buffer.concat(chunks),
    redirect: 'manual'
  });

  response.statusCode = upstream.status;
  for (const [key, value] of upstream.headers) {
    if (['content-encoding', 'content-length', 'transfer-encoding', 'set-cookie'].includes(key.toLowerCase())) continue;
    response.setHeader(key, value);
  }
  const cookies = typeof upstream.headers.getSetCookie === 'function'
    ? upstream.headers.getSetCookie()
    : [upstream.headers.get('set-cookie')].filter(Boolean);
  if (cookies.length) response.setHeader('set-cookie', cookies.map(cookie => cookie.replace(/;\s*Secure/gi, '')));
  response.setHeader('x-ramz-local-proxy', 'cloudflare-pages');
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

async function serveStatic(response, pathname) {
  let relative = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (!relative) relative = 'index.html';
  let filePath = path.resolve(staticRoot, relative);
  if (!filePath.startsWith(staticRoot + path.sep) && filePath !== staticRoot) return send(response, 403, 'text/plain; charset=utf-8', 'Forbidden');

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    const body = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.setHeader('cache-control', extension === '.html' || extension === '.js' ? 'no-store' : 'public, max-age=3600');
    return send(response, 200, mimeTypes[extension] || 'application/octet-stream', body);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const body = await fs.readFile(path.join(staticRoot, 'index.html'));
    response.setHeader('cache-control', 'no-store');
    return send(response, 200, mimeTypes['.html'], body);
  }
}

function send(response, status, contentType, body) {
  response.statusCode = status;
  response.setHeader('content-type', contentType);
  response.setHeader('x-content-type-options', 'nosniff');
  response.end(body);
}

server.listen(port, host, () => {
  console.log(`Ramz local app: http://${host}:${port}`);
  console.log(`API proxy: ${cloudOrigin}`);
});
