import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

// Order of data shape mimics visual structure of page
// Anything in an array can have multiple objects

const data: ReferenceEntityTemplateSchema = {
  // The title of the page.
  name: 'app dev',
  // A description of the reference entity. Can include Markdown.
  description: 'Run a dev server for your app.',
  // Optional. If used will cause the page to only be visible when the feature flag is enabled.
  // featureFlag: '',
  // // Optional. A short sentence of what is needed to use this entity, such as a version dependency.
  // requires: '',
  // Optional. What category the entity is: component, hook, utility, etc.
  type: 'component',
  // Boolean that determines if the entity is a visual component.
  isVisualComponent: false,
  // Optional. The example that appears in the right hand column at the top of the page. Represents the primary use case.
  defaultExample: {
    // Optional. If used will cause the card to only be visible when the feature flag is enabled.
    featureFlag: '',
    // Optional. An image preview of the example.
    image: '',
    // The data for the code block.
    codeblock: {
      // Tabs that appear at the top of the code block.
      tabs: [
        {
          // Optional. The title of the tab.
          title: '',
          // The relative file path to the code file. Content will be automatically extracted from that file.
          code: 'search.example.sh',
          // Optional. The name of the language of the code.
          language: '',
        },
      ],
      // The title of the code block.
      title: '',
      // Optional. Links to display in the top right corner of the code block.
      links: [
        {
          // Text to display in the tooltip.
          name: '',
          // Link url.
          url: '',
          // Icon name to display.
          icon: '',
        },
      ],
    },
  },
  // Optional. Displays generated TypeScript information, such as prop tables.
  // definitions: [
  //   {
  //     // Title of the list of definitions.
  //     title: '',
  //     // Description of the definitions. Can use Markdown.
  //     description: '',
  //     // Name of the TypeScript type this entity uses.
  //     type: '',
  //   },
  // ],
  // This determines where in the sidebar the entity will appear.
  category: 'Commands',
  subCategory: 'theme',
  // Optional. Further determines where in the sidebar category an entity will appear.
  // subCategory: '',
  // Optional. A thumbnail image to display in the category page.
  // thumbnail: '',
  // Optional. A section for examples. Examples may be grouped or ungrouped.
  examples: {
    // Description of the example section. Can use Markdown.
    description: '',
    // Optional. May be used to group examples of a certain theme.
    exampleGroups: [
      {
        // Optional. Title of the example group.
        title: '',
        // Optional. If used will cause the example group to only be visible when the feature flag is enabled.
        featureFlag: '',
        examples: [
          {
            // Optional. Description of the example. Can use Markdown.
            description: '',
            // Optional. If used will cause the example group to only be visible when the feature flag is enabled.
            featureFlag: '',
            // Optional. An image preview of the example.
            image: '',
            // The data for the code block.
            codeblock: {
              // Tabs that appear at the top of the code block.
              tabs: [
                {
                  // Optional. The title of the tab.
                  title: '',
                  // The relative file path to the code file. Content will be automatically extracted from that file.
                  code: 'search.example.sh',
                  // Optional. The name of the language of the code.
                  language: '',
                },
              ],
              // The title of the code block.
              title: '',
              // Optional. Links to display in the top right corner of the code block.
              links: [
                {
                  // Text to display in the tooltip.
                  name: '',
                  // Link url.
                  url: '',
                  // Icon name to display.
                  icon: '',
                },
              ],
            },
          },
        ],
      },
    ],
    // Optional. May be used to group examples without a particular theme.
    examples: [
      {
        // Optional. Description of the example. Can use Markdown.
        description: '',
        // Optional. If used will cause the example group to only be visible when the feature flag is enabled.
        featureFlag: '',
        // Optional. An image preview of the example.
        image: '',
        // The data for the code block.
        codeblock: {
          // Tabs that appear at the top of the code block.
          tabs: [
            {
              // Optional. The title of the tab.
              title: '',
              // The relative file path to the code file. Content will be automatically extracted from that file.
              code: 'search.example.sh',
              // Optional. The name of the language of the code.
              language: '',
            },
          ],
          // The title of the code block.
          title: '',
          // Optional. Links to display in the top right corner of the code block.
          links: [
            {
              // Text to display in the tooltip.
              name: '',
              // Link url.
              url: '',
              // Icon name to display.
              icon: '',
            },
          ],
        },
      },
    ],
  },
  // A section that displays related entities in a grid of cards.
  related: [
    {
      // Name of the related object/entity/link.
      name: '',
      // Optional. A subordinate title providing additional information. The subtitle should be limited to a one word description when in the related section.
      subtitle: '',
      // Link to the entity you wish to display in card form.
      url: '',
      // Optional. What category the entity is: component, hook, utility, etc. Determines the icon displayed on the card.
      type: '',
      // Optional. If used will cause the card to only be visible when the feature flag is enabled.
      featureFlag: '',
    },
  ],
}

export default data
