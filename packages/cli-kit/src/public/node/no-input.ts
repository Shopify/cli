import {Flags} from '@oclif/core'

export const noInputFlag = {
  'no-input': Flags.boolean({
    description: 'Disable interactive prompts and browser authentication.',
    env: 'SHOPIFY_FLAG_NO_INPUT',
  }),
}
