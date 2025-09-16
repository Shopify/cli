import {AbortError} from '@shopify/cli-kit/node/error'

export function throwUidMappingError() {
  const message = ['Your app has extensions which need to be assigned', {command: 'uid'}, 'identifiers.']
  const nextStep = [
    'You must first map IDs to your existing extensions by running',
    {command: 'shopify app deploy'},
    'interactively, without',
    {command: '--force'},
    ', to finish the migration.',
  ]
  const customSection = {
    title: 'Reference',
    body: {
      list: {
        items: [
          {
            link: {
              label: 'Migrating from the Partner Dashboard',
              url: 'https://shopify.dev/docs/apps/build/dev-dashboard/migrate-from-partners',
            },
          },
        ],
      },
    },
  }
  throw new AbortError(message, undefined, [nextStep], [customSection])
}
