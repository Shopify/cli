import {DevStorePlan, devStorePlanHandles} from '../services/store/constants.js'
import {renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'

/** Human-readable labels for each `--plan` handle, shown in the interactive plan selector. */
const PLAN_LABELS: {[plan in DevStorePlan]: string} = {
  basic: 'Basic',
  grow: 'Grow',
  advanced: 'Advanced',
  plus: 'Plus',
}

export async function storeNamePrompt(): Promise<string> {
  return renderTextPrompt({
    message: 'Name for the new development store',
  })
}

export async function storePlanPrompt(): Promise<DevStorePlan> {
  return renderSelectPrompt({
    message: 'Which Shopify plan do you want to use?',
    choices: devStorePlanHandles.map((handle) => ({
      label: PLAN_LABELS[handle],
      value: handle,
    })),
  })
}
