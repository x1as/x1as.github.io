// Локальный просмотр: node serve.mjs  →  http://localhost:4173
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 4173
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf', '.woff2': 'font/woff2' }

http.createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0])
  const full = resolve(DIR, '.' + (path === '/' ? '/index.html' : path))
  if (full !== DIR && !full.startsWith(DIR + sep)) { res.writeHead(403); return res.end() }
  try {
    const buf = await readFile(full)
    res.writeHead(200, { 'Content-Type': TYPES[extname(full).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    res.end(buf)
  } catch { res.writeHead(404); res.end('not found') }
}).listen(PORT, '127.0.0.1', () => console.log(`http://localhost:${PORT}`))
