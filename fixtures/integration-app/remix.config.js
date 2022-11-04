/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ['**/.*'],
  appDirectory: 'home',
  serverBuildTarget: 'netlify-edge',
  server: process.env.NETLIFY || process.env.NETLIFY_LOCAL ? './server.js' : undefined,
}
