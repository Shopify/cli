/**
 * The AbortController interface represents a controller object that allows you to abort one or more Web requests as and when desired.
 *
 * - MDN Documentation: https://developer.mozilla.org/en-US/docs/Web/API/AbortController
 *
 * This class exists to keep the historical `@shopify/cli-kit/node/abort` import path working
 * now that Node provides AbortController natively.
 */
export class AbortController extends globalThis.AbortController {}

/**
 * The AbortSignal interface represents a signal object that allows you to communicate with a DOM request (such as a fetch request) and abort it if required via an AbortController object.
 *
 * Note that AbortSignal cannot be constructed directly. Get one from an AbortController's
 * `signal` property or from the static helpers such as `AbortSignal.timeout()`.
 */
export const AbortSignal = globalThis.AbortSignal
export type AbortSignal = globalThis.AbortSignal
