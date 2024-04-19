import {
  renderAutocompletePrompt,
  renderConfirmationPrompt,
  renderSelectPrompt,
  renderTextPrompt,
  renderDangerousConfirmationPrompt,
} from '@shopify/cli-kit/node/ui'
import figures from '@shopify/cli-kit/node/figures'

export async function prompts() {
  // renderSelectPrompt
  await renderSelectPrompt({
    message: 'Associate your project with the org Castile Ventures?',
    choices: [
      {label: 'first', value: 'first', disabled: true},
      {label: 'second', value: 'second'},
      {label: 'third (limit reached)', value: 'third', disabled: true},
      {label: 'fourth (limit reached)', value: 'fourth', disabled: true},
      {label: 'fifth', value: 'fifth', group: 'Automations', disabled: true},
      {label: 'sixth', value: 'sixth', group: 'Automations'},
      {label: 'seventh', value: 'seventh'},
      {label: 'eighth (limit reached)', value: 'eighth', group: 'Merchant Admin', disabled: true},
      {label: 'ninth', value: 'ninth', group: 'Merchant Admin'},
      {label: 'tenth', value: 'tenth'},
    ],
    infoTable: [
      {
        header: 'add',
        items: ['new-ext'],
        bullet: '+',
      },
      {
        header: 'remove',
        items: ['integrated-demand-ext', 'order-discount'],
        bullet: '-',
      },
    ],
  })

  // renderTextPrompt
  await renderTextPrompt({
    message: 'App project name (can be changed later)',
    defaultValue: 'expansive commerce app',
    validate: (value) => {
      if (value.includes('shopify')) return 'Can\'t include "shopify" in the name'
    },
  })

  // renderAutocompletePrompt
  const database = [
    {label: 'first', value: 'first'},
    {label: 'second', value: 'second'},
    {label: 'third', value: 'third'},
    {label: 'fourth', value: 'fourth'},
    {label: 'fifth', value: 'fifth'},
    {label: 'sixth', value: 'sixth'},
    {label: 'seventh', value: 'seventh'},
    {label: 'eighth', value: 'eighth'},
    {label: 'ninth', value: 'ninth'},
    {label: 'tenth', value: 'tenth'},
    {label: 'eleventh', value: 'eleventh'},
    {label: 'twelfth', value: 'twelfth'},
    {label: 'thirteenth', value: 'thirteenth'},
    {label: 'fourteenth', value: 'fourteenth'},
    {label: 'fifteenth', value: 'fifteenth'},
    {label: 'sixteenth', value: 'sixteenth'},
    {label: 'seventeenth', value: 'seventeenth'},
    {label: 'eighteenth', value: 'eighteenth'},
    {label: 'nineteenth', value: 'nineteenth'},
    {label: 'twentieth', value: 'twentieth'},
    {label: 'twenty-first', value: 'twenty-first'},
    {label: 'twenty-second', value: 'twenty-second'},
    {label: 'twenty-third', value: 'twenty-third'},
    {label: 'twenty-fourth', value: 'twenty-fourth'},
    {label: 'twenty-fifth', value: 'twenty-fifth'},
    {label: 'twenty-sixth', value: 'twenty-sixth'},
    {label: 'twenty-seventh', value: 'twenty-seventh'},
    {label: 'twenty-eighth', value: 'twenty-eighth'},
    {label: 'twenty-ninth', value: 'twenty-ninth'},
    {label: 'thirtieth', value: 'thirtieth'},
    {label: 'thirty-first', value: 'thirty-first'},
    {label: 'thirty-second', value: 'thirty-second'},
    {label: 'thirty-third', value: 'thirty-third'},
    {label: 'thirty-fourth', value: 'thirty-fourth'},
    {label: 'thirty-fifth', value: 'thirty-fifth'},
    {label: 'thirty-sixth', value: 'thirty-sixth'},
    {label: 'thirty-seventh', value: 'thirty-seventh'},
    {label: 'thirty-eighth', value: 'thirty-eighth'},
    {label: 'thirty-ninth', value: 'thirty-ninth'},
    {label: 'fortieth', value: 'fortieth'},
    {label: 'forty-first', value: 'forty-first'},
    {label: 'forty-second', value: 'forty-second'},
    {label: 'forty-third', value: 'forty-third'},
    {label: 'forty-fourth', value: 'forty-fourth'},
    {label: 'forty-fifth', value: 'forty-fifth'},
    {label: 'forty-sixth', value: 'forty-sixth'},
    {label: 'forty-seventh', value: 'forty-seventh'},
    {label: 'forty-eighth', value: 'forty-eighth'},
    {label: 'forty-ninth', value: 'forty-ninth'},
    {label: 'fiftieth', value: 'fiftieth'},
  ]

  await renderAutocompletePrompt({
    message: 'Template',
    choices: database,
    search(term: string) {
      return Promise.resolve({data: database.filter((item) => item.label.includes(term))})
    },
  })

  const themes = [
    [
      'first theme',
      {
        subdued: `(#${1})`,
      },
    ],
    [
      'second theme',
      {
        subdued: `(#${2})`,
      },
    ],
  ]

  // renderConfirmationPrompt
  const options = {
    message: `Add the following themes to the store?`,
    infoTable: {'': themes},
    confirmationMessage: 'Yes, add them',
    cancellationMessage: 'Cancel',
  }

  await renderConfirmationPrompt(options)

  const infoMessage = {
    title: {
      color: 'red',
      text: `${figures.warning} This can't be undone.`,
    },
    body: 'The action you are executing should be confirmed to proceed.',
  }

  const dangerousPromptOptions = {
    message: `Delete the following themes from the store?`,
    infoTable: {'': themes},
    infoMessage,
    confirmationMessage: 'Yes, delete them',
    cancellationMessage: 'Cancel',
    defaultValue: false,
  }

  await renderConfirmationPrompt(dangerousPromptOptions)

  await renderConfirmationPrompt({
    message: ['Make the following changes to your', {filePath: '.env'}, 'file?'],
    defaultValue: true,
    confirmationMessage: 'Yes, confirm changes',
    cancellationMessage: 'No, make changes later',
  })

  // renderTextPrompt with dangerous confirmation
  await renderDangerousConfirmationPrompt({
    message: 'Release this version of Mega App?',
    infoTable: [
      {
        header: 'Includes',
        items: [
          'My subscription extension',
          'Order discount function',
          'Subscription cancelled trigger',
          'Add subscription action',
        ],
        bullet: '+',
      },
      {
        header: 'Removes',
        items: ['product-discount-function', 'product-subscription-extension'],
        bullet: '-',
      },
    ],
    confirmation: 'Mega App',
  })
}
