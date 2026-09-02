import {devStorePlanHandles} from '../services/dev/create-dev-store.js'
import * as ui from '@shopify/cli-kit/node/ui'
import type {DevStorePlan} from '../services/dev/create-dev-store.js'

const PLAN_LABELS: {[plan in DevStorePlan]: string} = {
  basic: 'Basic',
  grow: 'Grow',
  advanced: 'Advanced',
  plus: 'Plus',
}

export function devStoreNamePrompt(): Promise<string> {
  return ui.renderTextPrompt({message: 'Name for the new development store'})
}

export function devStorePlanPrompt(): Promise<DevStorePlan> {
  return ui.renderSelectPrompt({
    message: 'Which Shopify plan do you want to use?',
    choices: devStorePlanHandles.map((handle) => ({label: PLAN_LABELS[handle], value: handle})),
  })
}

export function devStoreDemoDataPrompt(): Promise<boolean> {
  return ui.renderConfirmationPrompt({
    message: 'Populate the store with demo data?',
    confirmationMessage: 'Yes, add demo data',
    cancellationMessage: 'No, start with an empty store',
    defaultValue: true,
  })
}
