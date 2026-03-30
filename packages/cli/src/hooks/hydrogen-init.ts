import {HOOKS} from '@shopify/cli-hydrogen'
import type {Hook} from '@oclif/core'

// cast through unknown because cli-hydrogen uses @oclif/core v3 while this package uses v4
const hook = HOOKS.init as unknown as Hook<'init'>
export default hook
