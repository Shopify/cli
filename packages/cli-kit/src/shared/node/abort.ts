import {AbortController as NodeAbortController, AbortSignal as NodeAbortControllerSignal} from 'node-abort-controller'

/**
 * The AbortController interface represents a controller object that allows you to abort one or more Web requests as and when desired.
 *
 * - MDN Documentation: https://developer.mozilla.org/en-US/docs/Web/API/AbortController
 *
 * This class is necessary because AbortController support was added to Node 15 and the minimum
 * version that we support is Node 14.
 */
export class AbortController extends NodeAbortController {}

/**
 * The AbortSignal interface represents a signal object that allows you to communicate with a DOM request (such as a fetch request) and abort it if required via an AbortController object.
 */
export class AbortSignal extends NodeAbortControllerSignal {}
