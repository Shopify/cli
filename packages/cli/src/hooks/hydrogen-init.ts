// Defer the @shopify/cli-hydrogen init hook to avoid loading the heavy package at startup.
// The actual init logic will run lazily when a hydrogen command is first executed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hook = async function (_this: any, _options: any) {
  // no-op at startup — deferred to prerun
}

export default hook
