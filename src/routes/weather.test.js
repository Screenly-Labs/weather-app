import { afterEach, describe, expect, it } from 'bun:test'
import weather from './weather'

const env = { OPEN_WEATHER_API_KEY: 'test-key' }
const ctx = { waitUntil () {} }
const ORIGINAL_FETCH = globalThis.fetch

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const call = (path = 'http://localhost/', e = env) =>
  weather.fetch(new Request(path), e, ctx)

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

describe('Weather route', () => {
  it('returns the upstream payload on success', async () => {
    const payload = { city: { name: 'Testville' }, list: [] }
    globalThis.fetch = async () => json(payload)

    const res = await call('http://localhost/?lat=37.77&lng=-122.43')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(payload)
  })

  it('escapes query params and the api key in the upstream URL', async () => {
    let capturedUrl
    globalThis.fetch = async (url) => {
      capturedUrl = url
      return json({})
    }

    // An injection attempt that tries to smuggle a second appid param.
    await call('http://localhost/?lat=37.77&lng=' + encodeURIComponent('-122&appid=evil'))

    const url = new URL(capturedUrl)

    // The injected value must stay a single `lon` param, not a second appid.
    expect(url.searchParams.get('lon')).toBe('-122&appid=evil')
    expect(url.searchParams.getAll('appid')).toEqual(['test-key'])
    expect(url.searchParams.get('lat')).toBe('37.77')
    expect(url.searchParams.get('units')).toBe('metric')
  })

  it('returns 502 when the upstream responds with a non-OK status', async () => {
    globalThis.fetch = async () => json({ cod: 401, message: 'Invalid API key.' }, 401)

    const res = await call('http://localhost/?lat=37.77&lng=-122.43')

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: true })
  })

  it('returns 504 when the upstream request times out', async () => {
    // Resolve well past the (tiny) configured timeout, but reject as soon as the
    // route's own AbortController fires, so the timeout path runs for real.
    globalThis.fetch = (url, opts) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(json({})), 200)
      opts.signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      })
    })

    const res = await call('http://localhost/?lat=37.77&lng=-122.43', { ...env, WEATHER_TIMEOUT_MS: '10' })

    expect(res.status).toBe(504)
    expect(await res.json()).toEqual({ error: true })
  })

  it('returns 502 when fetch fails for other reasons', async () => {
    globalThis.fetch = async () => { throw new Error('network down') }

    const res = await call('http://localhost/?lat=37.77&lng=-122.43')

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: true })
  })
})
