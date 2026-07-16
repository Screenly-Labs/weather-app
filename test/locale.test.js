import { afterEach, describe, expect, it } from 'bun:test'

// Unit tests for the client-side locale logic in assets/static/js/locale.js.
// These pure helpers were extracted from main.js into their own ES module so
// they can be imported directly here, while main.js stays an export-free
// self-executing browser script (bundled with locale.js inlined).
import {
  resolveLocale,
  usesFahrenheit,
  unitsCountry,
  regionOf,
  setLocale,
  setLocaleOverride,
  setTimeFormat,
  resolveHour12,
  owmLang,
  descriptionLang,
  descriptionLocale,
  formatTime,
  formatDate,
  getTimeByOffset,
  getCondCategory
} from '../assets/static/js/locale.js'

// Saturday 2026-06-20 13:30:00 UTC, as the unix seconds main.js works with.
const DT = Math.floor(Date.parse('2026-06-20T13:30:00Z') / 1000)

// formatTime(getTimeByOffset(...)) is independent of the machine timezone:
// getTimeByOffset and the default-timezone Intl formatter both read the same
// local components, so the two timezone dependencies cancel out.
const timeAt = (offsetHours) => formatTime(getTimeByOffset(offsetHours * 3600, DT))
const dateAt = (offsetHours) => formatDate(getTimeByOffset(offsetHours * 3600, DT))

describe('resolveLocale (CLDR likely-subtags)', () => {
  it('maps a country to its CLDR likely locale, script dropped', () => {
    expect(resolveLocale('US')).toBe('en-US')
    expect(resolveLocale('FR')).toBe('fr-FR')
    expect(resolveLocale('JP')).toBe('ja-JP')
    expect(resolveLocale('PR')).toBe('es-PR')
    expect(resolveLocale('BR')).toBe('pt-BR')
    expect(resolveLocale('CN')).toBe('zh-CN')
    // Region re-derives its likely script, so the bare tag still renders it.
    expect(resolveLocale('TW')).toBe('zh-TW')
  })

  it('uses CLDR national language, not a hand-picked signage default', () => {
    // These differ from the old curated table on purpose (CLDR adopted wholesale).
    expect(resolveLocale('KZ')).toBe('ru-KZ') // was kk-Cyrl-KZ
    expect(resolveLocale('CH')).toBe('de-CH') // was fr-CH
    expect(resolveLocale('ZA')).toBe('en-ZA') // was af-ZA
  })

  it('pins font-unsafe countries to English (Latin-only fonts)', () => {
    // CLDR would give these non-Latin scripts (zh/ur/ar) that the vendored
    // Latin fonts cannot render; keep them English so screens stay legible.
    expect(resolveLocale('HK')).toBe('en-HK')
    expect(resolveLocale('PK')).toBe('en-PK')
    expect(resolveLocale('SS')).toBe('en-SS')
    expect(resolveLocale('EH')).toBe('en-EH')
  })

  it('falls back to en-GB for unknown / non-country / malformed / missing codes (#3)', () => {
    expect(resolveLocale('ZZ')).toBe('en-GB') // CLDR "unknown region"
    expect(resolveLocale('XX')).toBe('en-GB') // well-formed but not assigned
    expect(resolveLocale('EU')).toBe('en-GB') // grouping code (Cloudflare emits it)
    expect(resolveLocale('QO')).toBe('en-GB') // outlying-oceania grouping
    expect(resolveLocale('T1')).toBe('en-GB') // malformed (Cloudflare Tor)
    expect(resolveLocale('')).toBe('en-GB')
    expect(resolveLocale(undefined)).toBe('en-GB')
  })
})

describe('usesFahrenheit (#2)', () => {
  it('flags the US and its territories', () => {
    for (const code of ['US', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM']) {
      expect(usesFahrenheit(code)).toBe(true)
    }
  })

  it('flags the other Fahrenheit countries', () => {
    for (const code of ['BS', 'KY', 'LR', 'PW', 'FM', 'MH']) {
      expect(usesFahrenheit(code)).toBe(true)
    }
  })

  it('uses Celsius elsewhere', () => {
    for (const code of ['FR', 'GB', 'DE', 'JP', 'ZZ']) {
      expect(usesFahrenheit(code)).toBe(false)
    }
  })
})

describe('time formatting (#1, #4)', () => {
  it('uses a 12-hour clock with AM/PM for en-US', () => {
    setLocale('US')
    expect(timeAt(-4)).toMatch(/^9:30(\s| )?AM$/i)
  })

  it('uses a 24-hour clock for en-GB, fr-FR, de-DE', () => {
    setLocale('GB')
    expect(timeAt(1)).toBe('14:30')
    setLocale('FR')
    expect(timeAt(2)).toBe('15:30')
    setLocale('DE')
    expect(timeAt(2)).toBe('15:30')
  })

  it('renders the location wall-clock from the timezone offset', () => {
    setLocale('JP')
    expect(timeAt(9)).toBe('22:30')
  })
})

describe('12h/24h override (?24h launch setting)', () => {
  // The override is sticky module state; clear it after each case so the other
  // tests keep seeing the location's locale default.
  afterEach(() => setTimeFormat(''))

  it('maps the 24h setting values to an hour12 override', () => {
    expect(resolveHour12('0')).toBe(true) // 12-hour
    expect(resolveHour12('1')).toBe(false) // 24-hour
    // Default / empty / unrecognized -> defer to the locale.
    expect(resolveHour12('')).toBeUndefined()
    expect(resolveHour12(null)).toBeUndefined()
    expect(resolveHour12(undefined)).toBeUndefined()
    expect(resolveHour12('yes')).toBeUndefined()
  })

  it('forces a 12-hour clock with AM/PM when ?24h=0, even for a 24h locale', () => {
    setLocale('GB') // en-GB is normally 24-hour
    setTimeFormat('0')
    expect(timeAt(1)).toMatch(/^2:30(\s| )?PM$/i) // 14:30 -> 2:30 PM
  })

  it('forces a 24-hour clock when ?24h=1, even for a 12h locale', () => {
    setLocale('US') // en-US is normally 12-hour
    setTimeFormat('1')
    const time = timeAt(-4) // 09:30
    expect(time).not.toMatch(/AM|PM/i)
    expect(time).toMatch(/^0?9:30$/)
  })

  it('an override survives a later setLocale() (sticky across rebuilds)', () => {
    setTimeFormat('1') // force 24h
    setLocale('US') // rebuilds formatters; must keep the 24h override
    expect(timeAt(-4)).not.toMatch(/AM|PM/i)
  })

  it('restores the locale default when the setting is empty', () => {
    setLocale('US')
    setTimeFormat('1') // force 24h
    expect(timeAt(-4)).not.toMatch(/AM|PM/i)
    setTimeFormat('') // back to locale default (12h for en-US)
    expect(timeAt(-4)).toMatch(/AM|PM/i)
  })
})

describe('locale override (?locale launch setting)', () => {
  // The override is sticky module state; clear it and reset to a known locale
  // after each case so the other tests keep seeing the location default.
  afterEach(() => {
    setLocaleOverride('')
    setTimeFormat('')
    setLocale('GB')
  })

  it('wins over the country-derived locale passed to setLocale', () => {
    setLocaleOverride('de-DE')
    setLocale('US') // location country would normally give en-US (12h)
    expect(timeAt(2)).toBe('15:30') // de-DE renders 24h
    expect(dateAt(2)).toMatch(/Juni/) // German month name
  })

  it('applies immediately, before any setLocale(country) call', () => {
    setLocaleOverride('fr-FR')
    expect(dateAt(2)).toMatch(/juin/) // French, without a setLocale() call
  })

  it('composes with the ?24h override (language from locale, format from 24h)', () => {
    setLocaleOverride('de-DE') // normally 24h
    setTimeFormat('0') // force 12h
    expect(timeAt(2)).toMatch(/^3:30(\s| )?PM$/i)
  })

  it('empty override restores auto-detect from the location country', () => {
    setLocaleOverride('de-DE')
    setLocaleOverride('') // clear
    setLocale('US')
    expect(timeAt(-4)).toMatch(/^9:30(\s| )?AM$/i) // back to en-US
  })

  it('ignores an unsupported / malformed override tag (stays on auto)', () => {
    setLocaleOverride('zzzzz') // well-formed but no engine data -> ignored
    setLocale('US')
    expect(timeAt(-4)).toMatch(/^9:30(\s| )?AM$/i) // en-US, not the engine default
    setLocaleOverride('!! junk') // malformed -> ignored
    setLocale('GB')
    expect(timeAt(1)).toBe('14:30') // en-GB
  })
})

describe('temperature units follow the locale override region', () => {
  afterEach(() => setLocaleOverride(''))

  it('regionOf extracts the ISO-3166 region subtag', () => {
    expect(regionOf('en-US')).toBe('US')
    expect(regionOf('de-DE')).toBe('DE')
    expect(regionOf('zh-Hant-TW')).toBe('TW')
    expect(regionOf('ha-Latn-NG')).toBe('NG')
    expect(regionOf('ar')).toBe('') // no region subtag
    expect(regionOf('')).toBe('')
  })

  it('uses the override region for units, over the location country', () => {
    setLocaleOverride('en-US') // US -> Fahrenheit
    expect(usesFahrenheit(unitsCountry('DE'))).toBe(true) // location Germany, region US
    setLocaleOverride('de-DE') // DE -> Celsius
    expect(usesFahrenheit(unitsCountry('US'))).toBe(false) // location US, region DE
  })

  it('falls back to the location country for a region-less override', () => {
    setLocaleOverride('ar') // no region
    expect(usesFahrenheit(unitsCountry('US'))).toBe(true) // follows location US
    expect(usesFahrenheit(unitsCountry('DE'))).toBe(false)
  })

  it('uses the location country when there is no override', () => {
    setLocaleOverride('')
    expect(usesFahrenheit(unitsCountry('US'))).toBe(true)
    expect(usesFahrenheit(unitsCountry('FR'))).toBe(false)
  })
})

describe('date localization (#1)', () => {
  it('renders month names in the location language', () => {
    setLocale('US')
    expect(dateAt(-4)).toMatch(/Jun/)
    setLocale('FR')
    expect(dateAt(2)).toMatch(/juin/)
    setLocale('DE')
    expect(dateAt(2)).toMatch(/Juni/)
  })

  it('pins the Gregorian calendar even for ar-SA (not Hijri)', () => {
    setLocale('SA')
    const date = dateAt(3)
    // Gregorian day 20 (in Latin or Arabic-Indic digits, depending on ICU);
    // a Hijri rendering would show day 5 in Muharram instead.
    expect(date).toMatch(/20|٢٠/)
    expect(date).not.toMatch(/محرم/) // محرم (Muharram)
  })
})

describe('getCondCategory (weather-reactive accent)', () => {
  it('maps OpenWeather condition ids to categories', () => {
    expect(getCondCategory(211)).toBe('thunderstorm')
    expect(getCondCategory(301)).toBe('drizzle')
    expect(getCondCategory(500)).toBe('rain')
    expect(getCondCategory(601)).toBe('snow')
    expect(getCondCategory(741)).toBe('haze')
    expect(getCondCategory(800)).toBe('clear')
    expect(getCondCategory(802)).toBe('clouds')
  })
})

describe('owmLang (weather-description language)', () => {
  it('maps a locale to its OpenWeatherMap language code', () => {
    expect(owmLang('de-DE')).toBe('de') // the reported bug: German description
    expect(owmLang('fr-FR')).toBe('fr')
    expect(owmLang('en-GB')).toBe('en')
    expect(owmLang('de')).toBe('de') // region-less tags still resolve
  })

  it("uses OWM's non-standard codes where they differ from ISO-639-1", () => {
    expect(owmLang('cs-CZ')).toBe('cz')
    expect(owmLang('lv-LV')).toBe('la')
    // Albanian is 'sq' in OWM's table too, so it must NOT be rewritten to 'al'.
    expect(owmLang('sq-AL')).toBe('sq')
    // CLDR maximizes NO to nb-NO, but OWM only documents plain 'no'.
    expect(owmLang('nb-NO')).toBe('no')
    expect(owmLang('no')).toBe('no')
  })

  it('distinguishes the region-specific variants OWM translates separately', () => {
    expect(owmLang('pt-BR')).toBe('pt_br')
    expect(owmLang('pt-PT')).toBe('pt')
  })

  it('keeps non-Latin scripts English, since the vendored fonts are latin-only', () => {
    expect(owmLang('ru-RU')).toBe('') // Cyrillic
    expect(owmLang('ja-JP')).toBe('') // CJK
    expect(owmLang('zh-CN')).toBe('')
    expect(owmLang('ar-SA')).toBe('') // RTL
    expect(owmLang('el-GR')).toBe('') // Greek
  })

  it('falls back to English for missing or malformed tags', () => {
    expect(owmLang('')).toBe('')
    expect(owmLang(undefined)).toBe('')
    expect(owmLang('zzzzz')).toBe('')
    expect(owmLang('not a tag')).toBe('')
  })
})

describe('descriptionLang (fetch-time language)', () => {
  afterEach(() => setLocaleOverride(''))

  it('translates the description for a ?locale override', () => {
    setLocaleOverride('de-DE')
    expect(descriptionLang()).toBe('de')
  })

  it('leaves the description English when the locale is auto-detected', () => {
    // Without an override the locale is only known once the country arrives in
    // the response body, which is after the description has been fetched.
    setLocaleOverride('')
    setLocale('DE')
    expect(descriptionLang()).toBe('')
  })

  it('ignores an unsupported override, matching the rest of the display', () => {
    setLocaleOverride('zzzzz')
    expect(descriptionLang()).toBe('')
  })
})

describe('descriptionLocale (casing / lang tag)', () => {
  afterEach(() => setLocaleOverride(''))

  it('reports the BCP-47 tag, never OWM\'s invented code', () => {
    // The lang attribute must be a real language subtag. OWM calls Czech 'cz'
    // and Latvian 'la'; tagging the DOM with those would mislabel the text.
    setLocaleOverride('cs-CZ')
    expect(descriptionLang()).toBe('cz') // what we send upstream
    expect(descriptionLocale()).toBe('cs-CZ') // what the DOM gets
    setLocaleOverride('lv-LV')
    expect(descriptionLang()).toBe('la')
    expect(descriptionLocale()).toBe('lv-LV')
  })

  it('tags a translated description', () => {
    setLocaleOverride('de-DE')
    expect(descriptionLocale()).toBe('de-DE')
  })

  it('leaves an English description untagged, so it keeps title case', () => {
    // Auto-detect and non-Latin scripts both keep OWM's English default; marking
    // those as de-DE/ru-RU would be a lie and would drop the title casing.
    setLocaleOverride('')
    setLocale('DE')
    expect(descriptionLocale()).toBe('')
    setLocaleOverride('ru-RU')
    expect(descriptionLocale()).toBe('')
  })
})
