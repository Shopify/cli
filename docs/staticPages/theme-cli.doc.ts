import {LandingTemplateSchema} from '@shopify/generate-docs'

const data: LandingTemplateSchema = {
  title: 'Themes',
  description:
    'Shopify CLI is a command-line interface tool that helps you build Shopify apps and themes. It quickly generates Shopify apps, themes, and custom storefronts. You can also use it to automate many common development tasks.',
  id: 'theme-cli',
  image: '/assets/landing-pages/templated-apis/web-pixels-api/landing-page.png',
  darkImage: '/assets/landing-pages/templated-apis/web-pixels-api/landing-page.png',
  sections: [
    {
      type: 'Generic',
      anchorLink: 'create',
      title: 'Create a new theme',
      sectionContent:
        'You need node version 18.12.0 or higher to use Shopify CLI.\n\nThis installs Shopify CLI globally, so you can run shopify commands from any directory. Find out more about the available commands by running `shopify` in your terminal.',
      codeblock: {
        title: '',
        tabs: [
          {
            title: 'npm',
            code: 'examples/install.npm.example.sh',
            language: 'bash',
          },
          {
            title: 'yarn',
            code: 'examples/install.yarn.example.sh',
            language: 'bash',
          },
          {
            title: 'pnpm',
            code: 'examples/install.pnpm.example.sh',
            language: 'bash',
          },
        ],
      },
    },
    {
      type: 'Generic',
      anchorLink: 'getting-started',
      title: 'Getting started',
      sectionContent: 'Some other content about themes',
    },
  ],
}

export default data
