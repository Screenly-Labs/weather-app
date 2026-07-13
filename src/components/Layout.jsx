import { html } from 'hono/html'

const Layout = (props) => html`<!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Screenly Weather App - Weather Forecast</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link
        rel="preload"
        href="/static/fonts/fraunces-latin-standard-normal.woff2?v=${props.v}"
        as="font"
        type="font/woff2"
        crossorigin
      />
      <link
        rel="preload"
        href="/static/fonts/hanken-grotesk-latin-wght-normal.woff2?v=${props.v}"
        as="font"
        type="font/woff2"
        crossorigin
      />
      <!-- Degraded mode for older/weaker signage players. Runs before the
           stylesheet so html.legacy is set on the first paint: flags the device
           as legacy when the browser engine is old (no Element.replaceChildren,
           a 2020-era API) or the hardware looks weak, then the stylesheet drops
           all animation. classList.add keeps it idempotent. -->
      <script>
        (function () {
          try {
            var slow =
              (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
              (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2)
            var old = !('replaceChildren' in Element.prototype)
            if (slow || old) document.documentElement.classList.add('legacy')
          } catch (e) {
            document.documentElement.classList.add('legacy')
          }
        })()
      </script>
      <link rel="stylesheet" href="/static/styles/main.css?v=${props.v}" />
      <!-- Expose the asset version so main.js can cache-bust the image URLs it
           builds at runtime (weather icons, backgrounds). -->
      <script>window.__ASSET_V='${props.v}'</script>
      <script
        src="https://js.sentry-cdn.com/${props.sentryId}.min.js"
        crossorigin="anonymous"
      ></script>
      <!-- Google tag (gtag.js) -->
      <script async src="https://www.googletagmanager.com/gtag/js?id=${props.gaId}"></script>
      <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());

        gtag('config', '${props.gaId}');
      </script>
      <!-- main.js is a self-executing classic script (no ES module export), so
           a plain async <script> runs it and any cached HTML stays compatible
           across deploys. The ?v= busts it whenever the bundle changes. -->
      <script src="/static/js/main.js?v=${props.v}" async defer></script>
    </head>
    <body>
      ${props.children}
    </body>
  </html>`

export default Layout
