import {renderAutocompletePrompt, renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'

export async function prompts() {
  // renderSelectPrompt
  await renderSelectPrompt({
    message: 'Associate your project with the org Castile Ventures?',
    choices: [
      {label: 'first', value: 'first', key: 'f'},
      {label: 'second', value: 'second', key: 's'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
      {label: 'fifth', value: 'fifth', group: 'Automations', key: 'a'},
      {label: 'sixth', value: 'sixth', group: 'Automations'},
      {label: 'seventh', value: 'seventh'},
      {label: 'eighth', value: 'eighth', group: 'Merchant Admin'},
      {label: 'ninth', value: 'ninth', group: 'Merchant Admin'},
      {label: 'tenth', value: 'tenth'},
    ],
    infoTable: {add: ['new-ext'], remove: ['integrated-demand-ext', 'order-discount']},
  })

  // renderTextPrompt
  await renderTextPrompt({
    message: 'App project name (can be changed later)',
    defaultValue: 'expansive commerce app',
  })

  const database = [
    {label: 'first', value: 'first'},
    {label: 'second', value: 'second'},
    {label: 'third', value: 'third'},
    {label: 'fourth', value: 'fourth'},
    {label: 'fifth', value: 'fifth'},
    {label: 'sixth', value: 'sixth'},
  ]

  // renderAutocompletePrompt
  await renderAutocompletePrompt({
    message: 'Select a template',
    choices: [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
    ],
    search(term: string) {
      return Promise.resolve(database.filter((item) => item.label.includes(term)))
    },
  })
}
