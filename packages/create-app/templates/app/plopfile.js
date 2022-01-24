export default function (plop) {
  plop.setGenerator('app', {
    description: 'Shopify app',
    prompts: [
      {
        type: 'input',
        name: 'app_name',
        message: 'What is the name of your app?'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Enter a short description of your app.'
      },
      {
        type: 'input',
        name: 'author',
        message: 'Who is the app author?'
      },
    ],
    actions: [
      {
        type: 'addMany',
        base: __dirname,
        destination: process.cwd(),
        templateFiles: './**/*'
      },
      {
        type: 'modify',
        path: 'package.json',
        pattern: /{{SHOPIFY_CLI_VERSION}}/,
        template: process.env.npm_package_version
      }
    ]
  });
};
