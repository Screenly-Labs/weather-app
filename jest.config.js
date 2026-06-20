module.exports = {
  testEnvironment: 'wrangler',
  testMatch: ['**/test/**/*.+(ts|tsx|js|jsx)', '**/src/**/(*.)+(spec|test).+(ts|tsx|js|jsx)'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['esbuild-jest', { jsxFactory: 'jsx', jsxFragment: 'Fragment' }]
  },
  // `hono/serve-static.module` targets the Workers runtime and imports the
  // build-time `__STATIC_CONTENT_MANIFEST` virtual module, which doesn't exist
  // under jest. The tests don't serve static assets, so stub the middleware.
  moduleNameMapper: {
    '^hono/serve-static\\.module$': '<rootDir>/test-utils/serve-static-stub.js'
  }
}
