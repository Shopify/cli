import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  // The title of the page.
  name: 'trigger',
  // Optional. A description of the reference entity. Can include Markdown.
  description: `
  Triggers the delivery of a sample Admin API event topic payload to a designated address.

  You should use this command to experiment with webhooks, to initially test your webhook configuration, or for unit testing. However, to test your webhook configuration from end to end, you should always trigger webhooks by performing the related action in Shopify.

  Because most webhook deliveries use remote endpoints, you can trigger the command from any directory where you can use Shopify CLI, and send the webhook to any of the supported endpoint types. For example, you can run the command from your app's local directory, but send the webhook to a staging environment endpoint.

  To learn more about using webhooks in a Shopify app, refer to [Webhooks overview](https://shopify.dev/docs/apps/webhooks).

  ### Limitations

  - Webhooks triggered using this method always have the same payload, so they can't be used to test scenarios that differ based on the payload contents.
  - Webhooks triggered using this method aren't retried when they fail.
  - Trigger requests are rate-limited using the Partner API rate limit.
  - You can't use this method to validate your API webhook subscriptions.
  `,
  overviewPreviewDescription: 'Triggers the delivery of a sample Admin API webhook',
  // Optional. What category the entity is: component, hook, utility, etc.
  type: 'command',
  // Boolean that determines if the entity is a visual component.
  isVisualComponent: false,
  // Optional. The example that appears in the right hand column at the top of the page. Represents the primary use case.
  defaultExample: {
    // The data for the code block.
    codeblock: {
      // Tabs that appear at the top of the code block.
      tabs: [
        {
          // Optional. The title of the tab.
          title: 'webhook trigger',
          // The relative file path to the code file. Content will be automatically extracted from that file.
          code: './examples/webhookTrigger.example.sh',
          // Optional. The name of the language of the code.
          language: 'bash',
        },
      ],
      // Optional. The title of the example.
      title: 'webhook trigger',
    },
  },
  // Optional. Displays generated TypeScript information, such as prop tables.
  definitions: [
    {
      // Title of the list of definitions.
      title: 'webhook trigger flags',
      // Description of the definitions. Can use Markdown.
      description: 'The following flags are available for the `webhook trigger` command:',
      // Name of the TypeScript type this entity uses.
      type: 'webhookTrigger',
    },
  ],
  // This determines where in the sidebar the entity will appear.
  category: 'Commands',
  // Optional. The subcategory of the page.
  subCategory: 'webhook',
  // A section that displays related entities in a grid of cards.
  related: [
    // {
    //   // Name of the related object/entity/link.
    //   name: 'Generate docs package',
    //   subtitle: 'Navigate to',
    //   // Link to the entity you wish to display in card form.
    //   url: '/internal/generate-docs',
    //   // Optional. What category the entity is: component, hook, utility, etc. Determines the icon displayed on the card.
    //   type: 'tutorial',
    // },
  ],
}

export default data
