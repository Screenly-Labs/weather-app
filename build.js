#!/usr/bin/env bun
/* global Bun */
// Builds the served static assets through @screenly-labs/signage-kit (shared
// support floor + down-leveling recipe). The client JS is bundled to a self-
// executing classic script and each CSS file is down-leveled + minified in place.
// The shared degraded-mode kill-switch is prepended to the CSS by the kit
// (includeDegraded), so it lives in the package, not here.
//
// The assets are served directly from ./assets by wrangler's [site] config and
// referenced at /static/.... main.js is the bundled artifact (gitignored) built
// from main.src.js; pass --client to skip the CSS step entirely (used by `bun run
// dev`). Skipping the step does not un-minify anything: it just leaves the CSS
// files on disk untouched, so `bun run dev` serves whatever is already there
// (minified or not). Note: --client also skips the includeDegraded injection, so
// if the on-disk CSS lacks the html.legacy kill-switch a `bun run dev` build
// won't add it; build without --client to exercise degraded mode locally.

import { readFileSync } from 'node:fs'
import { Glob } from 'bun'
import { bundleJs, processCss } from '@screenly-labs/signage-kit/build'
import { run as syncFonts } from './sync-fonts.js'

const clientOnly = process.argv.includes('--client')

// Shared chrome CSS from @screenly-labs/signage-kit — the canonical @font-face set
// and the standardized fixed footer badge. Prepended to this app's raw main.css at
// build time (a raw-CSS Worker can't resolve a bare `@import`), so the shared rules
// land before the app's, which override where they overlap.
const sharedCss = ['fonts.css', 'brand.css']
  .map((f) => readFileSync(Bun.resolveSync(`@screenly-labs/signage-kit/styles/${f}`, import.meta.dir), 'utf8'))
  .join('\n')

// Vendor the Bun-managed webfonts into ./assets first.
await syncFonts()

// ---- Client JS bundle: main.src.js -> main.js (inlining ./locale.js + the
// shared polyfills shim), a self-contained IIFE at the floor's syntax level with
// no `export`/`import`, loadable by every cached HTML variant.
try {
  await bundleJs('assets/static/js/main.src.js', 'assets/static/js/main.js')
} catch (error) {
  console.error('✗ Failed to build assets/static/js/main.js')
  console.error(error)
  process.exit(1)
}
console.log('✓ JS: assets/static/js/main.js')

// ---- CSS: down-level + minify in place (skipped for --client), with the shared
// html.legacy kill-switch prepended by the kit.
if (!clientOnly) {
  for await (const path of new Glob('assets/static/styles/*.css').scan('.')) {
    try {
      const code = await processCss(`${sharedCss}\n${await Bun.file(path).text()}`, {
        includeDegraded: true,
        filename: path
      })
      await Bun.write(path, code)
    } catch (error) {
      console.error(`✗ Failed to build ${path}`)
      console.error(error)
      process.exit(1)
    }
    console.log(`✓ CSS: ${path}`)
  }
}

console.log(`Build complete${clientOnly ? ' (client JS only)' : ''}.`)
