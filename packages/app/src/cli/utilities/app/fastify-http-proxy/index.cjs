const {convertUrlToWebSocket} = require('./utils.cjs')
const From = require('@fastify/reply-from')
const WebSocket = require('ws')
const {time} = require('console')

const httpMethods = ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT', 'OPTIONS']
const urlPattern = /^https?:\/\//

function liftErrorCode(code) {
  if (typeof code !== 'number') {
    // Sometimes "close" event emits with a non-numeric value
    return 1011
  } else if (code === 1004 || code === 1005 || code === 1006) {
    // ws module forbid those error codes usage, lift to "application level" (4xxx)
    return 4000 + (code % 1000)
  } else {
    return code
  }
}

function closeWebSocket(socket, code, reason) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.close(liftErrorCode(code), reason)
  }
}

function waitConnection(socket, write) {
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.once('open', write)
  } else {
    write()
  }
}

function isExternalUrl(url = '') {
  return urlPattern.test(url)
}

function proxyWebSockets(source, target) {
  function close(code, reason) {
    closeWebSocket(source, code, reason)
    closeWebSocket(target, code, reason)
  }

  source.on('message', (data) => waitConnection(target, () => target.send(data, {binary: false})))
  source.on('ping', (data) => waitConnection(target, () => target.ping(data)))
  source.on('pong', (data) => {
    console.log('PONG!')
    waitConnection(target, () => target.pong(data))
  })
  source.on('close', close)
  source.on('error', (error) => close(1011, error.message))
  source.on('unexpected-response', () => close(1011, 'unexpected response'))

  // source WebSocket is already connected because it is created by ws server
  target.on('message', (data) => source.send(data, {binary: false}))
  target.on('ping', (data) => source.ping(data))
  target.on('pong', (data) => source.pong(data))
  target.on('close', close)
  target.on('error', (error) => close(1011, error.message))
  target.on('unexpected-response', () => close(1011, 'unexpected response'))
}

let totalTime = 0
function setupWebSocketProxy(fastify, options, rewritePrefix) {
  const server = new WebSocket.Server({
    server: fastify.server,
    ...options.wsServerOptions,
  })

  fastify.addHook('onClose', (instance, done) => server.close(done))

  // To be able to close the HTTP server,
  // all WebSocket clients need to be disconnected.
  // Fastify is missing a pre-close event, or the ability to
  // add a hook before the server.close call. We need to resort
  // to monkeypatching for now.
  const oldClose = fastify.server.close
  fastify.server.close = function (done) {
    for (const client of server.clients) {
      client.close()
    }
    oldClose.call(this, done)
  }

  server.on('error', (err) => {
    fastify.log.error(err)
  })

  server.on('connection', (source, request) => {
    console.log('New Connection')

    const timer = setInterval(() => {
      if (source.readyState >= 2) {
        console.log('closed connection, finishing up')
        clearInterval(timer)
      } else {
        totalTime += 5
        console.log('Sending ping, total time: ', totalTime)
        source.ping()
      }
    }, 5000)

    if (fastify.prefix && !request.url.startsWith(fastify.prefix)) {
      fastify.log.debug({url: request.url}, 'not matching prefix')
      console.log('CLOSING INTERVAL!')
      clearInterval(timer)
      source.close()
      return
    }

    let optionsWs = {}
    if (request.headers.cookie) {
      const headers = {cookie: request.headers.cookie}
      optionsWs = {...options.wsClientOptions, headers}
    } else {
      optionsWs = options.wsClientOptions
    }

    const url = createWebSocketUrl(request)

    const target = new WebSocket(url, optionsWs)

    fastify.log.debug({url: url.href}, 'proxy websocket')
    proxyWebSockets(source, target)
  })

  function createWebSocketUrl(request) {
    const source = new URL(request.url, 'ws://127.0.0.1')

    const target = new URL(
      source.pathname.replace(fastify.prefix, rewritePrefix),
      convertUrlToWebSocket(options.upstream),
    )

    target.search = source.search

    return target
  }
}

function generateRewritePrefix(prefix, opts) {
  if (!prefix) {
    return ''
  }

  let rewritePrefix = opts.rewritePrefix || (opts.upstream ? new URL(opts.upstream).pathname : '/')

  if (!prefix.endsWith('/') && rewritePrefix.endsWith('/')) {
    rewritePrefix = rewritePrefix.slice(0, -1)
  }

  return rewritePrefix
}

async function httpProxy(fastify, opts) {
  if (
    !opts.upstream &&
    !(opts.upstream === '' && opts.replyOptions && typeof opts.replyOptions.getUpstream === 'function')
  ) {
    throw new Error('upstream must be specified')
  }

  const preHandler = opts.preHandler || opts.beforeHandler
  const rewritePrefix = generateRewritePrefix(fastify.prefix, opts)

  const fromOpts = {...opts}
  fromOpts.base = opts.upstream
  fromOpts.prefix = undefined

  const oldRewriteHeaders = (opts.replyOptions || {}).rewriteHeaders
  const replyOpts = {...opts.replyOptions, rewriteHeaders}
  fromOpts.rewriteHeaders = rewriteHeaders

  fastify.register(From, fromOpts)

  if (opts.proxyPayloads !== false) {
    fastify.addContentTypeParser('application/json', bodyParser)
    fastify.addContentTypeParser('*', bodyParser)
  }

  function rewriteHeaders(headers) {
    const location = headers.location
    if (location && !isExternalUrl(location)) {
      headers.location = location.replace(rewritePrefix, fastify.prefix)
    }
    if (oldRewriteHeaders) {
      headers = oldRewriteHeaders(headers)
    }
    return headers
  }

  function bodyParser(req, payload, done) {
    done(null, payload)
  }

  fastify.route({
    url: '/',
    method: opts.httpMethods || httpMethods,
    preHandler,
    config: opts.config || {},
    constraints: opts.constraints || {},
    handler,
  })
  fastify.route({
    url: '/*',
    method: opts.httpMethods || httpMethods,
    preHandler,
    config: opts.config || {},
    constraints: opts.constraints || {},
    handler,
  })

  function handler(request, reply) {
    const queryParamIndex = request.raw.url.indexOf('?')
    let dest = request.raw.url.slice(0, queryParamIndex !== -1 ? queryParamIndex : undefined)
    dest = dest.replace(this.prefix, rewritePrefix)
    reply.from(dest || '/', replyOpts)
  }

  if (opts.websocket) {
    setupWebSocketProxy(fastify, opts, rewritePrefix)
  }
}

httpProxy[Symbol.for('plugin-meta')] = {
  fastify: '4.x',
  name: '@fastify/http-proxy',
}

module.exports = httpProxy
module.exports.default = httpProxy
module.exports.fastifyHttpProxy = httpProxy
