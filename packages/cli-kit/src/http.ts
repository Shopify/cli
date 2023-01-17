import FormData from 'form-data'

export {shopifyFetch} from './private/node/api/rest.js'
export {fetch} from './private/node/api/rest.js'

export function formData() {
  return new FormData()
}

export {
  createApp,
  createRouter,
  IncomingMessage,
  ServerResponse,
  CompatibilityEvent,
  createError,
  send,
  sendError,
  sendRedirect,
  H3Error,
} from 'h3'
