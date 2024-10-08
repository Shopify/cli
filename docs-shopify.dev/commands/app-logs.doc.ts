// This is an autogenerated file. Don't edit this file manually.
import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'app logs',
  description: `
  Opens a real-time stream of detailed app logs from the selected app and store.
  Use the \`--source\` argument to limit output to a particular log source, such as a specific Shopify Function handle. Use the \`shopify app logs sources\` command to view a list of sources.
  Use the \`--status\` argument to filter on status, either \`success\` or \`failure\`.
  \`\`\`
  shopify app logs --status=success --source=extension.discount-function
  \`\`\`
  `,
  overviewPreviewDescription: `Stream detailed logs for your Shopify app.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'app logs',
          code: './examples/app-logs.example.sh',
          language: 'bash',
        },
      ],
      title: 'app logs',
    },
  },
  definitions: [
  {
    title: 'Flags',
    description: 'The following flags are available for the `app logs` command:',
    type: 'applogs',
  },
  ],
  category: 'app',
  related: [
  ],
}

export default data