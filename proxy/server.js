import http from 'http'
import https from 'https'
import { URL } from 'url'

const PORT = 3001
const PRIVATE_IP = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|localhost)/i
const BLOCK_PRIVATE = !!process.env.VERCEL

// Opt-in: accept a self-signed / untrusted TLS cert on the upstream HTTPS WebDAV
// server. Many self-hosted NAS WebDAV servers (e.g. Synology on :5006) ship a
// self-signed cert, which Node's https.request rejects by default — the upstream
// request then errors and the proxy returns 502 before any request reaches the
// NAS. Enabling this sets rejectUnauthorized:false on the upstream request ONLY.
// Trust trade-off: only enable on a trusted LAN talking to your own NAS; it
// disables cert verification for the proxied WebDAV hop. Off by default.
const INSECURE_TLS = process.env.WEBDAV_PROXY_INSECURE_TLS === '1' ||
  process.env.WEBDAV_PROXY_INSECURE_TLS === 'true'
if (INSECURE_TLS) {
  console.warn('[webdav-proxy] WEBDAV_PROXY_INSECURE_TLS enabled — upstream HTTPS cert verification is OFF')
}

const FORWARD_REQ_HEADERS = [
  'authorization', 'x-webdav-auth', 'content-type',
  'if-match', 'depth', 'destination',
]
const FORWARD_RES_HEADERS = [
  'content-type', 'etag', 'last-modified', 'dav', 'allow',
]

http.createServer(async (req, res) => {
  // Support both ?url= (used by @glance-apps/sync) and X-WebDAV-Url header (used by intents transport)
  const qs = new URL(req.url, 'http://localhost').searchParams
  const target = qs.get('url') || req.headers['x-webdav-url']

  if (!target) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Missing target URL' }))
  }

  let url
  try { url = new URL(target) } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Invalid URL' }))
  }

  if (BLOCK_PRIVATE && PRIVATE_IP.test(url.hostname)) {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Private IP blocked' }))
  }

  const headers = {}
  for (const h of FORWARD_REQ_HEADERS) {
    if (req.headers[h]) headers[h] = req.headers[h]
    // x-webdav-auth carries credentials — map to Authorization for the upstream
    if (h === 'x-webdav-auth' && req.headers[h] && !req.headers['authorization']) {
      headers['authorization'] = req.headers[h]
    }
  }

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = chunks.length ? Buffer.concat(chunks) : null

  const lib = url.protocol === 'https:' ? https : http
  const reqOptions = { method: req.method, headers }
  // Accept a self-signed upstream cert only when explicitly opted in, and only for
  // the HTTPS hop (no effect on plain HTTP).
  if (url.protocol === 'https:' && INSECURE_TLS) reqOptions.rejectUnauthorized = false
  const upstreamReq = lib.request(
    target,
    reqOptions,
    (upstreamRes) => {
      const resHeaders = {}
      for (const h of FORWARD_RES_HEADERS) {
        const v = upstreamRes.headers[h]
        if (v) resHeaders[h] = v
      }
      res.writeHead(upstreamRes.statusCode, resHeaders)
      upstreamRes.pipe(res)
    }
  )

  upstreamReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Upstream error', detail: err.message }))
    }
  })

  if (body) upstreamReq.write(body)
  upstreamReq.end()
}).listen(PORT, () => {
  console.log(`WebDAV proxy listening on :${PORT}`)
})
