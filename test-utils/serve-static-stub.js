// `hono/serve-static.module` targets the Cloudflare Workers runtime and pulls in
// the build-time `__STATIC_CONTENT_MANIFEST` virtual module. Tests don't serve
// static assets, so we stub the middleware with a pass-through.
const serveStatic = () => async (c, next) => next()
module.exports = { serveStatic }
