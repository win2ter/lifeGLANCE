export const config = { api: { bodyParser: false } };

const PRIVATE_IP = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|localhost)/i;

export default async function handler(req, res) {
  const target = req.headers['x-webdav-url'];
  if (!target) return res.status(400).json({ error: 'Missing X-WebDAV-Url header' });

  let url;
  try { url = new URL(target); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

  if (PRIVATE_IP.test(url.hostname)) return res.status(403).json({ error: 'Private IP blocked' });

  const headers = {};
  for (const h of ['authorization', 'x-webdav-auth', 'content-type', 'if-match', 'depth', 'destination']) {
    if (req.headers[h]) headers[h] = req.headers[h];
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  try {
    const upstream = await fetch(target, { method: req.method, headers, body });
    const responseHeaders = {};
    for (const h of ['content-type', 'etag', 'last-modified', 'dav', 'allow']) {
      const v = upstream.headers.get(h);
      if (v) responseHeaders[h] = v;
    }
    const responseBody = await upstream.arrayBuffer();
    res.writeHead(upstream.status, responseHeaders);
    res.end(Buffer.from(responseBody));
  } catch (err) {
    res.status(502).json({ error: 'Upstream error', detail: err.message });
  }
}
