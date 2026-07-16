// Stale-player notice: warns viewers whose player is an old Anthias build, and
// points them at the free upgrade with a QR code. Kept out of main.src.js so the
// predicate can be unit-tested with a real ES module import — main.src.js bundles
// this in and must stay export-free (see the build note in main.src.js).

// An untagged QtWebEngine player IS an old Anthias — that is the call this app
// makes, and the copy names Anthias on the strength of it.
//
// Don't "correct" this to `vendor === 'anthias'`. signage-kit's profiler sets
// that vendor only on the explicit `Anthias/` UA token, which is precisely what
// the old builds we are trying to reach do not send — so the obvious-looking
// test matches every player except the ones the notice exists for. Every other
// QtWebEngine player identifies itself, which is what makes the residual
// untagged bucket attributable:
//
//   old Anthias   QtWebEngine/5.15.2 Chrome/83  -> vendor null    (untagged)
//   current       QtWebEngine/6.8.2  Chrome/122 -> vendor 'anthias'
//   Screenly      ... screenly-viewer           -> vendor 'screenly'
//   BrightSign    QtWebEngine/5.11.2 Chrome/65  -> vendor 'brightsign'
//
// Engine age is deliberately NOT part of the test either. Sending the token is
// itself the mark of a current build, so an untagged player is out of date
// whichever Chromium it carries — gating on belowFloor as well would miss a
// build new enough to have reached Qt6 but still too old to identify itself.
//
// And don't reach for `profile.platform` to narrow the bucket. It looks like the
// obvious way to say "Anthias is Raspberry Pi first", but it is measured, not
// guessed, and the measurement says no:
//
//   * Every QtWebEngine player resolves to platform 'linux', old Anthias and
//     BrightSign alike, so the field has no separating power here at all.
//   * 'raspberry-pi' comes only from a literal `Raspbian` token, which the old
//     Anthias UA does not carry. Requiring it matches NO player, so it would not
//     tighten the notice, it would silently switch it off. Same shape of mistake
//     as the `vendor === 'anthias'` trap above.
//
// The BrightSign exclusion is also sturdier than it looks. Its roHtmlWidget lets
// an integrator replace the UA outright, which would drop the `BrightSign/`
// token this relies on. But a hand-written replacement does not carry a
// `QtWebEngine` token either, so such a player fails this test on the engine
// instead of the vendor and still sees nothing. Only a verbatim copy of the
// stock UA with the product token surgically removed would misfire.
export const isStalePlayer = (profile) =>
  profile.vendor === null && profile.engine.name === 'qtwebengine'

// The sign speaks for itself — first person is what makes an unattended screen
// asking to be fixed land as friendly rather than as an error dialog. Note what
// it does NOT say: no version number and no year, because the UA only tells us
// the player is untagged, not how old it is. "from years ago" is the strongest
// claim the detection actually supports.
export const STALE_MESSAGE =
  "Psst — I'm still running Anthias from years ago. Nobody's updated me in a while. Scan to fix that, free."

// Where the QR points. build.js encodes this exact string into the SVG at build
// time, so the image and the link can never disagree.
//
// UTM medium is `qr` because that is literally the only way this link is ever
// followed — it is never clickable, so a scan is the whole channel. The campaign
// matches the clock app's verbatim, on purpose: it is one cross-app push at the
// same audience, and the useful question is how many stale players upgraded in
// total, with utm_source splitting that by which app did the telling.
export const UPGRADE_URL =
  'https://anthias.screenly.io/get-started/?utm_source=weather-app&utm_medium=qr&utm_campaign=anthias-stale-player'

export const QR_SRC = '/static/images/anthias-upgrade-qr.svg'

// Build the notice element. Kept separate from the profile check so the copy and
// the markup are testable without a profiler round-trip. `v` is the asset
// version — the QR is served from a versioned URL like every other asset, so it
// picks up the immutable 1-year cache rather than the 5-minute legacy TTL.
export const createStaleNotice = (doc, v) => {
  const el = doc.createElement('aside')
  el.className = 'stale-notice'
  el.id = 'stale-notice'
  // `note`, deliberately not `status`: status is an implicit aria-live="polite"
  // region, and there is nothing here to announce. The notice is present from
  // first paint rather than arriving as an update, so a live region would only
  // interrupt to read out content already sitting on the page. `note` also
  // overrides the `complementary` landmark <aside> would otherwise carry, which
  // overstates a corner tag as a page-level region.
  el.setAttribute('role', 'note')

  const text = doc.createElement('p')
  text.className = 'stale-notice-text'
  text.textContent = STALE_MESSAGE

  const qr = doc.createElement('img')
  qr.className = 'stale-notice-qr'
  qr.src = v ? `${QR_SRC}?v=${v}` : QR_SRC
  // The URL is in the alt text because a camera is the only way to act on the
  // QR — a viewer who cannot see the image still gets somewhere to type.
  qr.alt = `Upgrade instructions: ${UPGRADE_URL}`
  qr.width = 96
  qr.height = 96

  el.appendChild(text)
  el.appendChild(qr)
  return el
}

// Mount the notice when the profile warrants it. Returns true when it mounted,
// so the caller (and the tests) can tell the no-op case apart.
export const mountStaleNotice = (profile, doc, v) => {
  if (!isStalePlayer(profile)) return false
  if (doc.querySelector('#stale-notice')) return false
  doc.body.appendChild(createStaleNotice(doc, v))
  return true
}
