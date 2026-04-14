// Defer the @shopify/app init hook to avoid loading the heavy package at startup.
// The actual init logic (clearing command cache + setting COMMAND_RUN_ID) will run
// lazily when an app command is first executed, via the prerun hook.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hook = async function (_this: any, _options: any) {
  // no-op at startup — deferred to prerun
}

export default hook
