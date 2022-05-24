/* eslint-disable */
/// <reference types='node' />

import {FastifyPluginCallback, preHandlerHookHandler} from 'fastify'

import {FastifyReplyFromOptions, FastifyReplyFromHooks} from '@fastify/reply-from'

import {ClientOptions, ServerOptions} from 'ws'

export interface FastifyHttpProxyOptions extends FastifyReplyFromOptions {
  upstream: string
  prefix?: string
  rewritePrefix?: string
  proxyPayloads?: boolean
  preHandler?: preHandlerHookHandler
  beforeHandler?: preHandlerHookHandler
  config?: Object
  replyOptions?: FastifyReplyFromHooks
  websocket?: boolean
  wsClientOptions?: ClientOptions
  wsServerOptions?: ServerOptions
  httpMethods?: string[]
  constraints?: {[name: string]: any}
}

export const fastifyHttpProxy: FastifyPluginCallback<FastifyHttpProxyOptions>
export default fastifyHttpProxy
