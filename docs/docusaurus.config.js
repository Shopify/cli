module.exports = {
  title: 'Shopify CLI Next',
  tagline:
    'This website contains documentation for contributors and maintainers of the Shopify CLI.',
  url: 'https://shopify-cli-next.docs.shopify.io',
  baseUrl: '/',
  onBrokenLinks: 'error',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'Shopify',
  projectName: 'shopify-cli-next',
  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    prism: {
      additionalLanguages: ['ruby', 'sql'],
    },
    navbar: {
      title: 'Shopify CLI Next',
      items: [
        {
          href: 'https://github.com/shopify/shopify-cli-next',
          label: 'GitHub',
          position: 'right',
        },
        {
          type: 'doc',
          docId: 'core/introduction',
          position: 'left',
          label: '@shopify/core',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Microsite Docs',
          items: [
            {
              label: 'Microsite Docs',
              to: 'https://development.shopify.io/engineering/keytech/apidocs/microsites',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/shopify/shopify-cli-next',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Shopify Inc.`,
    },
  },
  plugins: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        docsDir: 'docs',
        indexPages: true,
        docsRouteBasePath: '/',
      },
    ],
  ],
  themes: ['@shopify/docusaurus-shopify-theme'],
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
          path: 'docs',
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl:
            'https://github.com/shopify/shopify-cli-next/edit/main/docs/',
        },
        blog: false,
        sitemap: false,
      },
    ],
  ],
};
