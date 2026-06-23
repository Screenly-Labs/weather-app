import { describe, expect, it, mock } from 'bun:test'

// hono/serve-static.module targets the Workers runtime (it pulls in the
// build-time __STATIC_CONTENT_MANIFEST). Stub it before importing the app.
mock.module('hono/serve-static.module', () => ({
  serveStatic: () => async (c, next) => next()
}))

const app = (await import('.')).default

describe('Test the application', () => {
  it('redirects a location-less request to a default location', async () => {
    const res = await app.request('http://localhost/')
    expect(res.status).toBe(301)
    expect(res.headers.get('Location')).toContain('lat=')
    expect(res.headers.get('Location')).toContain('lng=')
  })
})
