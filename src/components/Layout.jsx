import { html, raw } from 'hono/html'
import { GATE } from '@screenly-labs/signage-kit/gate'

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
      <!-- Shared degraded-mode gate from @screenly-labs/signage-kit, before the
           stylesheet so html.legacy is set on the first paint. -->
      ${raw(GATE)}
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
