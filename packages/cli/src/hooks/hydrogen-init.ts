import {Hook} from '@oclif/core'

/**
 * Hydrogen init hook — only loads `@shopify/cli-hydrogen` when running a hydrogen command.
 * This avoids the ~300ms+ import cost for non-hydrogen commands.
 */
const hook: Hook<'init'> = async (options) => {
  if (!options.id?.startsWith('hydrogen:') || options.id === 'hydrogen:init') {
    return
  }

  const {HOOKS} = await import('@shopify/cli-hydrogen')
  if (HOOKS.init && typeof HOOKS.init === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (HOOKS.init as any).call(this, options)
  }
}

export default hook
