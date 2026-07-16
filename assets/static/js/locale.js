// Locale, formatting and pure weather helpers, extracted from main.js so they
// can be unit-tested with a real ES module import. main.js bundles this in at
// build time; keeping these here (and OUT of main.js's exports) is what lets
// main.js stay a plain self-executing browser script with no `export` token -
// see the build note in main.js / Layout.jsx.

/**
 * Countries / territories using the Fahrenheit scale:
 * United States (+ territories: Puerto Rico, Guam, US Virgin Islands,
 * American Samoa, Northern Mariana Islands, US Minor Outlying Islands),
 * Bahamas, Cayman Islands, Liberia, Palau, Federated States of Micronesia,
 * Marshall Islands.
 */
const countriesUsingFahrenheit = [
  'US', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM',
  'BS', 'KY', 'LR', 'PW', 'FM', 'MH'
]

export const celsiusToFahrenheit = (temp) => ((1.8 * temp) + 32)
export const usesFahrenheit = (code) => countriesUsingFahrenheit.includes(code)

// Countries whose CLDR likely locale is a non-Latin script the vendored (Latin
// only) fonts cannot render: pin them to English so live screens stay legible
// instead of showing tofu or flipping to RTL. HK/PK carried English in the old
// hand table; SS/EH default to English too.
const LOCALE_OVERRIDES = { HK: 'en-HK', PK: 'en-PK', SS: 'en-SS', EH: 'en-EH' }

// CLDR grouping codes that Intl.DisplayNames still *names* (so knownRegion would
// accept them) but that must not resolve to a locale: they fall through to the
// neutral signage fallback. Codes DisplayNames does not name (XX, Cloudflare's
// AP) or that are malformed (Cloudflare's T1) already fall through on their own.
const NON_COUNTRY = new Set(['ZZ', 'EU', 'EZ', 'UN', 'QO'])

// Lazily built Intl.DisplayNames that recognizes real ISO-3166 regions (with
// fallback:'none' a known country yields its name, unknown-but-well-formed codes
// yield undefined). Built on first use inside a try, not at module load, so an
// engine without Intl.DisplayNames degrades to the fallback instead of throwing
// while locale.js loads and taking the whole inlined bundle down with it.
let regionNames
const knownRegion = (code) => {
  if (!regionNames) {
    regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
  }
  return Boolean(regionNames.of(code))
}

// Default locale when the country is unknown. en-GB gives 24h time and
// neutral English month/day names (better for signage than the player's
// own device locale, which is effectively random).
const FALLBACK_LOCALE = 'en-GB'

// Right-to-left primary language subtags that a resolved locale may carry.
const rtlLanguages = ['ar', 'fa', 'he', 'ps', 'dv', 'ur', 'ckb', 'sd', 'yi']

// BCP-47 locale for the displayed location, plus cached Intl formatters.
let locale = 'en-GB'
// Explicit 12h/24h override from the ?24h launch setting: true forces a 12-hour
// clock, false forces 24-hour, undefined leaves the choice to the locale. This
// is the query param the signage-app manifest's "24h" setting drives.
let hour12Override
// Explicit BCP-47 locale from the ?locale launch setting. When set it wins over
// the displayed location's country-derived locale; undefined = auto-detect.
let localeOverride
let timeFormatter
let dateFormatterLong
let dateFormatterShort

const buildFormatters = () => {
  // Pin the Gregorian calendar so the date always matches the (Gregorian)
  // forecast — otherwise locales like ar-SA would render a Hijri date.
  // Names, ordering and numerals stay localized.
  // Only pin hour12 when the ?24h setting forced it; otherwise omit it so Intl
  // keeps the location locale's own 12/24h convention.
  const h12 = hour12Override === undefined ? {} : { hour12: hour12Override }
  const timeOpts = { hour: 'numeric', minute: '2-digit', ...h12 }
  const dateLongOpts = { weekday: 'long', month: 'short', day: 'numeric', calendar: 'gregory' }
  const dateShortOpts = { weekday: 'short', month: 'short', day: 'numeric', calendar: 'gregory' }
  try {
    // Intl picks 12h vs 24h, localized month/day names and AM/PM per locale.
    timeFormatter = new Intl.DateTimeFormat(locale, timeOpts)
    dateFormatterLong = new Intl.DateTimeFormat(locale, dateLongOpts)
    dateFormatterShort = new Intl.DateTimeFormat(locale, dateShortOpts)
  } catch {
    // Malformed locale string: fall back rather than break the clock.
    locale = FALLBACK_LOCALE
    timeFormatter = new Intl.DateTimeFormat(locale, timeOpts)
    dateFormatterLong = new Intl.DateTimeFormat(locale, dateLongOpts)
    dateFormatterShort = new Intl.DateTimeFormat(locale, dateShortOpts)
  }
}

// Country (ISO-3166 alpha-2) -> BCP-47 locale, via CLDR likely-subtags built
// into the engine (Intl.Locale.maximize), so there is no hand-maintained table:
// 'US' -> 'en-US', 'BR' -> 'pt-BR', 'DE' -> 'de-DE'. The script subtag is
// dropped because the region re-derives its likely script (e.g. 'zh-TW' still
// renders Traditional). A few countries are pinned to English (LOCALE_OVERRIDES)
// for font/RTL reasons; unknown, non-country, or malformed codes get the neutral
// signage fallback rather than CLDR's world default.
export const resolveLocale = (code) => {
  if (LOCALE_OVERRIDES[code]) return LOCALE_OVERRIDES[code]
  try {
    if (NON_COUNTRY.has(code) || !knownRegion(code)) return FALLBACK_LOCALE
    const max = new Intl.Locale(`und-${code}`).maximize()
    return `${max.language}-${max.region}`
  } catch {
    return FALLBACK_LOCALE
  }
}

// Map the ?24h launch setting to an hour12 override. The manifest's "24h" enum
// is "" (locale default), "0" (12-hour) and "1" (24-hour); any other value is
// treated as the default. Returns true for a forced 12h clock, false for a
// forced 24h clock, or undefined to defer to the locale.
export const resolveHour12 = (value) => {
  if (value === '1') return false
  if (value === '0') return true
  return undefined
}

// Apply the ?24h launch setting (see resolveHour12). Passing '' / undefined /
// any unrecognized value clears the override and restores the locale default.
export const setTimeFormat = (value) => {
  const next = resolveHour12(value)
  // Skip the formatter rebuild when nothing changes (the common no-override
  // path at startup), so init() does not rebuild on top of the module-load and
  // setLocale builds for no reason.
  if (next === hour12Override) return
  hour12Override = next
  buildFormatters()
}

const applyLocale = (loc) => {
  locale = loc
  buildFormatters()
  // The chrome is authored in English (LTR); only the city, date and time
  // render in the location's language. Tag just those elements with the right
  // lang/dir so assistive tech and RTL scripts (e.g. ar) are handled without
  // mirroring the whole LTR layout. Read `locale` after buildFormatters so a
  // fallback (malformed override) is reflected in the tag.
  if (typeof document !== 'undefined') {
    const dir = rtlLanguages.includes(locale.split('-')[0]) ? 'rtl' : 'ltr'
    for (const id of ['city', 'date', 'time']) {
      const el = document.querySelector(`#${id}`)
      if (el) {
        el.lang = locale
        el.dir = dir
      }
    }
  }
}

// True when the engine actually has data for a BCP-47 tag. A well-formed but
// unreal tag (e.g. 'zzzzz') is NOT caught by buildFormatters' try/catch because
// Intl.DateTimeFormat silently falls back to the default locale rather than
// throwing, so validate up front instead.
const isSupportedLocale = (tag) => {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([tag]).length > 0
  } catch {
    return false
  }
}

// Apply the ?locale launch setting (a BCP-47 tag, or '' to auto-detect). A set
// override wins over the country passed to setLocale; it is applied at once so
// formatting is correct before weather data arrives, and stays sticky across
// the later setLocale(country) rebuild. An unsupported/malformed tag is ignored
// (cleared to auto) so it can never pin the display to the engine default.
export const setLocaleOverride = (value) => {
  localeOverride = value && isSupportedLocale(value) ? value : undefined
  if (localeOverride) applyLocale(localeOverride)
}

export const setLocale = (code) => applyLocale(localeOverride || resolveLocale(code))

// OpenWeatherMap's `lang` codes are mostly the ISO-639-1 subtag, but a few
// predate it and disagree. Only the codes owmLang can actually emit are listed,
// i.e. Latin-script ones; OWM's non-Latin oddities (kr, ua, zh_cn, zh_tw) are
// deliberately absent because the script guard below never lets them through.
// An unlisted language passes through as its bare subtag, which OWM either
// translates or quietly answers in English - the same as sending nothing.
//   cs -> cz  OWM predates the ISO code for Czech.
//   lv -> la  'la' is really Latin, but OWM uses it for Latvian.
//   nb -> no  CLDR maximizes NO to nb-NO (Bokmal); OWM only knows plain 'no'.
const OWM_LANG = { cs: 'cz', lv: 'la', nb: 'no', nn: 'no' }
// Languages OWM translates per-region rather than per-language.
const OWM_LANG_BY_TAG = { 'pt-BR': 'pt_br' }

// True when a locale renders in the Latin alphabet, per CLDR likely-subtags
// rather than a hand-listed set of languages.
const isLatinScript = (tag) => {
  try {
    return new Intl.Locale(tag).maximize().script === 'Latn'
  } catch {
    return false
  }
}

// OWM `lang` code for the weather description, or '' to leave it in English.
// The description is the one string we cannot format ourselves, so it has to be
// requested in the right language upstream (see the weather route).
//
// Non-Latin-script locales deliberately stay English: the vendored fonts ship
// latin subsets only (see build.js), so a Cyrillic/CJK/Arabic description would
// render as tofu on a live screen. This is the same reasoning as LOCALE_OVERRIDES
// above, applied to the one field that comes from upstream instead of from Intl.
export const owmLang = (tag) => {
  if (!tag || !isLatinScript(tag)) return ''
  try {
    const { language, region } = new Intl.Locale(tag)
    return OWM_LANG_BY_TAG[`${language}-${region}`] || OWM_LANG[language] || language
  } catch {
    return ''
  }
}

// The OWM `lang` for the *current* display locale, i.e. what the description
// should be translated into. Only a ?locale override is known early enough to
// influence the fetch; without one the locale is derived from the country in the
// response body, by which point the description has already been fetched, so the
// auto-detected case keeps OWM's English default.
export const descriptionLang = () => owmLang(localeOverride)

// The BCP-47 tag the description was actually translated into, or '' when it is
// OWM's English default. This is deliberately NOT the OWM code: 'cz' and 'la'
// are OWM's own inventions (Czech is really 'cs', Latvian 'lv'), so feeding them
// to a lang attribute would mislabel the text. Drives the casing rule in the CSS
// - English title-cases the description, German capitalizes only its nouns.
export const descriptionLocale = () => (descriptionLang() ? localeOverride : '')

// ISO-3166 region subtag of a BCP-47 tag ('en-US' -> 'US', 'zh-Hant-TW' -> 'TW',
// 'ha-Latn-NG' -> 'NG'), or '' when the tag carries no region ('ar', 'fr') or is
// malformed. Uses the built-in Intl.Locale parser rather than a hand-rolled one.
export const regionOf = (tag) => {
  try {
    return new Intl.Locale(tag).region || ''
  } catch {
    return ''
  }
}

// The country whose unit convention (°C/°F) applies. A ?locale override that
// carries a region wins, so temperature units follow the chosen region; with no
// override (or a region-less one) units follow the displayed location's country.
export const unitsCountry = (locationCountry) =>
  (localeOverride && regionOf(localeOverride)) || locationCountry

// Build defaults up front so the clock works even before any data arrives.
buildFormatters()

export const getTimeByOffset = (offsetinSecs, dt) => {
  const now = dt ? new Date(dt * 1000) : new Date()
  const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000)
  return new Date(utc + (offsetinSecs * 1000))
}

// getTimeByOffset returns a Date whose *local-time* components already read
// as the location's wall clock, so the default-timezone Intl formatters
// (which read the same local components) render the correct local time/date.
export const formatTime = (dateObj) => timeFormatter.format(dateObj)

export const formatDate = (dateObj) => {
  const wide = typeof window === 'undefined' || window.innerWidth >= 480
  const formatter = wide ? dateFormatterLong : dateFormatterShort
  return formatter.format(dateObj)
}

// Simplified condition category used to drive the weather-reactive accent.
export const getCondCategory = (id) => {
  if (id >= 200 && id <= 299) return 'thunderstorm'
  if (id >= 300 && id <= 399) return 'drizzle'
  if (id >= 500 && id <= 599) return 'rain'
  if (id >= 600 && id <= 699) return 'snow'
  if (id >= 700 && id <= 799) return 'haze'
  if (id === 800) return 'clear'
  return 'clouds'
}
