import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { describe, expect, it } from 'bun:test'

// The notice builds real DOM, so this suite needs a document — Bun's runner has
// no globals of its own. This runs after the static imports below are evaluated
// (ESM hoists them), not before; what it has to beat is the first *test*, which
// it does. That ordering is only safe because stale-player.js touches no DOM at
// import time — it just defines functions and takes `doc` as an argument. Keep
// it that way, or this needs a dynamic import instead.
GlobalRegistrator.register()

import { detectPlayer } from '@screenly-labs/signage-kit/profiler'
import {
  createStaleNotice,
  isStalePlayer,
  mountStaleNotice,
  STALE_MESSAGE,
  UPGRADE_URL
} from '../assets/static/js/stale-player.js'

// Real UA strings, kept identical to signage-kit's own profiler fixtures so this
// suite fails loudly if the kit ever reclassifies one of them.
const UA = {
  // The target: QtWebEngine 5.15 / Chrome 83, carrying no vendor token at all.
  oldAnthias:
    'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/5.15.2 Chrome/83.0.4103.122 Safari/537.36',
  // Current Anthias tags itself and is on Qt6 / Chrome 122.
  currentAnthias:
    'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/6.8.2 Chrome/122.0.6261.171 Safari/537.36 Anthias/2026.7.1',
  // Same old engine, but identifies itself — must not be told to upgrade Anthias.
  brightsign:
    'BrightSign/UJE9C2001890/8.0.94 (XT1144)Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/5.11.2 Chrome/65.0.3325.230 Safari/537.36',
  screenly:
    'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/5.15.2 Chrome/83.0.4103.122 Safari/537.36 screenly-viewer/2.0',
  chrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
}

const profile = (ua) => detectPlayer(ua, '')

describe('isStalePlayer', () => {
  it('flags an untagged QtWebEngine player as old Anthias', () => {
    expect(isStalePlayer(profile(UA.oldAnthias))).toBe(true)
    // The profiler will not name Anthias here — that is expected, and is the
    // whole reason the predicate keys on the absence of a vendor instead.
    expect(profile(UA.oldAnthias).vendor).toBeNull()
  })

  it('leaves current, self-tagged Anthias alone', () => {
    // Guards the whole point of the feature: a player that is already up to date
    // must never be told it is out of date.
    expect(profile(UA.currentAnthias).vendor).toBe('anthias')
    expect(isStalePlayer(profile(UA.currentAnthias))).toBe(false)
  })

  it('does not tell BrightSign to upgrade Anthias, despite the same old engine', () => {
    const p = profile(UA.brightsign)
    expect(p.engine.name).toBe('qtwebengine')
    expect(isStalePlayer(p)).toBe(false)
  })

  it('flags an untagged player even on a current engine', () => {
    // Sending the Anthias/ token is what marks a build as current, so reaching
    // Qt6 without it still means out of date.
    const p = profile(
      'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/6.8.2 Chrome/122.0.6261.171 Safari/537.36'
    )
    expect(p.belowFloor).toBe(false)
    expect(isStalePlayer(p)).toBe(true)
  })

  it('does not tell a Screenly player to upgrade Anthias', () => {
    expect(isStalePlayer(profile(UA.screenly))).toBe(false)
  })

  it('leaves an ordinary desktop browser alone', () => {
    expect(isStalePlayer(profile(UA.chrome))).toBe(false)
  })

  it('does not resolve old Anthias to raspberry-pi, so platform cannot gate this', () => {
    // Pins the reason isStalePlayer ignores profile.platform. "Anthias is Pi
    // first, so require platform raspberry-pi" is the tempting narrowing, and it
    // would match nothing: the platform only comes from a literal Raspbian token
    // that the target UA does not send. If this ever starts reporting
    // 'raspberry-pi', the comment on isStalePlayer needs revisiting.
    expect(profile(UA.oldAnthias).platform).toBe('linux')
    // And platform is not a discriminator anyway: the player we exclude reports
    // exactly the same one.
    expect(profile(UA.brightsign).platform).toBe('linux')
  })

  it('stays quiet on a custom UA that names no engine', () => {
    // Why this case is here: roHtmlWidget lets a BrightSign integrator replace
    // the UA and drop the `BrightSign/` token the exclusion leans on. Nothing
    // then identifies the device as BrightSign, which is exactly the point of
    // the fixture below being an arbitrary custom string rather than anything
    // BrightSign-shaped: it is what such a player looks like from here. It fails
    // this test on the engine instead of the vendor, so it still sees nothing.
    const p = profile('AcmeKiosk/1.0')
    expect(p.vendor).toBeNull()
    expect(p.engine.name).toBeNull()
    expect(isStalePlayer(p)).toBe(false)
  })

  it('stays quiet on a non-QtWebEngine player with no vendor', () => {
    // The notice is an accusation; an unrecognised engine gets the benefit of
    // the doubt rather than a guess.
    const p = { vendor: null, engine: { name: null, version: null }, belowFloor: null }
    expect(isStalePlayer(p)).toBe(false)
  })
})

describe('createStaleNotice', () => {
  it('encodes the upgrade URL in the alt text so it is reachable without a camera', () => {
    const el = createStaleNotice(document, 'abc123')
    expect(el.querySelector('.stale-notice-qr').alt).toContain(UPGRADE_URL)
  })

  it('carries the UTM campaign on the URL the QR encodes', () => {
    const url = new URL(UPGRADE_URL)
    // utm_source is what splits this app's share out of a campaign the clock app
    // also runs; the campaign name is shared between them on purpose.
    expect(url.searchParams.get('utm_source')).toBe('weather-app')
    expect(url.searchParams.get('utm_medium')).toBe('qr')
    expect(url.searchParams.get('utm_campaign')).toBe('anthias-stale-player')
  })

  it('versions the QR src so it gets the immutable asset cache', () => {
    expect(createStaleNotice(document, 'abc123').querySelector('.stale-notice-qr').src).toContain(
      '?v=abc123'
    )
  })

  it('omits the version query when no asset version is available', () => {
    const src = createStaleNotice(document, '').querySelector('.stale-notice-qr').src
    expect(src).toContain('/static/images/anthias-upgrade-qr.svg')
    expect(src).not.toContain('?v=')
  })

  it('is not a live region — there is nothing to announce', () => {
    // `status` would be an implicit aria-live="polite", which would interrupt to
    // read out copy that has been on the page since first paint. Guards against
    // that creeping back in.
    const el = createStaleNotice(document, 'v')
    expect(el.getAttribute('role')).toBe('note')
    expect(el.hasAttribute('aria-live')).toBe(false)
  })

  it('speaks in the player’s own voice', () => {
    expect(createStaleNotice(document, 'v').querySelector('.stale-notice-text').textContent).toBe(
      STALE_MESSAGE
    )
  })
})

describe('mountStaleNotice', () => {
  it('mounts once for a stale player', () => {
    document.body.innerHTML = ''
    expect(mountStaleNotice(profile(UA.oldAnthias), document, 'v')).toBe(true)
    expect(document.querySelectorAll('.stale-notice').length).toBe(1)
  })

  it('does not mount twice if called again', () => {
    document.body.innerHTML = ''
    mountStaleNotice(profile(UA.oldAnthias), document, 'v')
    expect(mountStaleNotice(profile(UA.oldAnthias), document, 'v')).toBe(false)
    expect(document.querySelectorAll('.stale-notice').length).toBe(1)
  })

  it('mounts nothing for a healthy player', () => {
    document.body.innerHTML = ''
    expect(mountStaleNotice(profile(UA.currentAnthias), document, 'v')).toBe(false)
    expect(document.querySelector('.stale-notice')).toBeNull()
  })
})
