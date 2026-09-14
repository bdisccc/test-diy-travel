import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function transitProxyPlugin({ busMapsKey, otpBaseUrl }) {
  return {
    name: 'diy-travel-transit-proxy',
    configureServer(server) {
      server.middlewares.use('/api/transit/busmaps', async (req, res) => {
        if (!busMapsKey) {
          sendJson(res, 503, { error: 'BUSMAPS_NOT_CONFIGURED' })
          return
        }
        try {
          const incoming = new URL(req.url || '/', 'http://localhost')
          const upstreamUrl = new URL(`https://capi.busmaps.com:8443/v1${incoming.pathname}`)
          upstreamUrl.search = incoming.search
          const upstream = await fetch(upstreamUrl, {
            method: req.method || 'GET',
            headers: {
              Accept: 'application/json',
              'capi-key': `Bearer ${busMapsKey}`,
              'capi-host': 'busmaps.com',
            },
          })
          const text = await upstream.text()
          const contentType = String(upstream.headers.get('content-type') || '').toLowerCase()
          if (!contentType.includes('json')) {
            sendJson(res, 502, { error: 'BUSMAPS_INVALID_RESPONSE' })
            return
          }
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(text || '{}')
        } catch (error) {
          console.warn('[DIY Travel] BusMaps proxy:', error?.message || error)
          sendJson(res, 502, { error: 'BUSMAPS_UNREACHABLE' })
        }
      })

      server.middlewares.use('/api/transit/otp', async (req, res) => {
        try {
          const body = ['POST', 'PUT', 'PATCH'].includes(String(req.method || '').toUpperCase())
            ? await readRequestBody(req)
            : undefined
          const incoming = new URL(req.url || '/', 'http://localhost')
          const base = String(otpBaseUrl || 'http://localhost:8080').replace(/\/$/, '')
          const upstreamUrl = `${base}/otp${incoming.pathname}${incoming.search}`
          const upstream = await fetch(upstreamUrl, {
            method: req.method || 'GET',
            headers: {
              Accept: 'application/json',
              ...(body?.length ? { 'Content-Type': String(req.headers['content-type'] || 'application/json') } : {}),
            },
            body: body?.length ? body : undefined,
          })
          const text = await upstream.text()
          const contentType = String(upstream.headers.get('content-type') || '').toLowerCase()
          if (!contentType.includes('json')) {
            sendJson(res, upstream.status === 404 ? 404 : 502, { error: upstream.status === 404 ? 'OTP_NOT_CONFIGURED' : 'OTP_INVALID_RESPONSE' })
            return
          }
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(text || '{}')
        } catch (error) {
          console.warn('[DIY Travel] OTP proxy:', error?.message || error)
          sendJson(res, 503, { error: 'OTP_OFFLINE' })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // GitHub Pages project sites live under /<repository-name>/.
    // The deployment workflow sets VITE_BASE_PATH automatically.
    base: env.VITE_BASE_PATH || '/',
    plugins: [
      react(),
      transitProxyPlugin({
        busMapsKey: env.BUSMAPS_API_KEY || '',
        otpBaseUrl: env.OTP_BASE_URL || 'http://localhost:8080',
      }),
    ],
  }
})
