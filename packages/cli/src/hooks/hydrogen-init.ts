import {HOOKS} from '@shopify/cli-hydrogen'
import type {Hook} from '@oclif/core'

const hook = HOOKS.init as unknown as Hook<'init'>
export default hook
