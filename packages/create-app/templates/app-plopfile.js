const path = require('path');

module.exports = function (plop) {
  plop.setGenerator('app', {
    description: 'Shopify app',
    prompts: [
      {
        type: 'input',
        name: 'silent',
        message: 'swallows init from argv'
      },
      {
        type: 'input',
        name: 'name',
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
      }
    ],
    actions: [
      {
        type: 'addMany',
        base: path.join(__dirname, 'app'),
        destination: path.join(process.cwd(), '{{dashCase name}}'),
        templateFiles: path.join(__dirname, 'app/(**/*|*)'),
        data: {
          shopify_cli_version: "^0.0.0"
        }
      }
    ]
  });
};
