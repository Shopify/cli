# Shopify CLI Extensions

`shopify-extensions` is an add-on to the Shopify CLI, which is installed automatically when installing the CLI. It is not meant to be invoked directly. Instead, invocation of `shopify-extensions` occurs through `shopify extension`. Today, `shopify-extensions`' main purpose is to power the experience of `shopify extension serve`, `shopify extension build` and augment `shopify extension create`.

The information below is mainly targeting contributors rather than users. If you want to learn more about how to build extensions and how to use the Shopify CLI in general, please consult the [official documentation](https://shopify.dev/apps/tools/cli).

## Setup

Install Go:

```sh
brew install go
```

## Test

To run the tests, simply execute the following shell command:

```sh
make test
```

### Bootstrap extensions

To bootstrap extensions and install of node dependencies, run:

```sh
make bootstrap
```

This will create extensions in the `tmp` folder and install the node dependencies. It will also build the Dev Console app.

### Serve

After [boostrapping an extension](#bootstrap-an-extension), you can run the server by execute the following shell command:

```sh
make run serve testdata/shopifile.yml
```

Subsequently, you should be able to retrieve sample assets as follows:

```sh
curl http://localhost:8000/extensions/00000000-0000-0000-0000-000000000000/assets/index.js
```

Going to root end point http://localhost:8000 will take you to the Dev Console app.

## Publish UI Extension Server kit and Node Shopify CLI Extensions

Create a new branch. Then do a version bump.

```sh
yarn version-bump
```

Then push up bump, plus changes.

```sh
git push --follow-tags
```

Once the PR for the new branch is merged, you can deploy the packages on [Shipit](https://shipit.shopify.io/shopify/shopify-cli-extensions/production).

## Create

To create new extension projects, simply execute the following shell command:

```sh
make run serve testdata/shopifile.yml
```

This will create a new extension inside the `tmp/checkout_ui_extension` folder. You can update `testdata/shopifile.yml` if you want to test different options.

The YAML file is in the format of

```yml
extensions:
  - uuid: 00000000-0000-0000-0000-000000000000
    type: TYPE
    development:
      root_dir: 'api/testdata'
      build_dir: 'build'
      template: TEMPLATE_NAME
      renderer:
        name: RENDERER_LIBRARY
```

**RENDERER_LIBRARY**

- @shopify/checkout-ui-extensions

**TYPE**

- checkout_ui_extension

**TEMPLATE_NAME**

- typescript
- javascript
- typescript-react
- javascript-react

## Manual integration testing

The easiest way to test the integration with the [Shopify CLI](https://github.com/Shopify/shopify-cli) is to clone the aforementioned repository and

1. run `rake extensions:install` to download the latest extension server binary and place it in `ext/shopify-extensions`, followed by
2. running `config feature extension_server_beta --enable` to obtain the necessary feature flag.

Afterwards, the following three commands will be executed by the new extension server:

- `shopify extension create`
- `shopify extension serve`
- `shopify extension build`

## DevConsole

### Build

The build process is taken care of in the dev server build step. You can also run it yourself.

```sh
make bootstrap

# or
yarn build
```

### Development

The Dev Console needs a built dev server to connect to via a WebSocket.

```sh
# If you haven't already
make bootstrap
```

Then, run the DevConsole app and Dev Server simultaneously when developing for the DevConsole.

```sh
# This will run `make run serve testdata/shopifile.yml` and `yarn start`
make serve-dev testdata/shopifile.yml
```

## Node Package Commands

`start`: Start up the DevConsole app
`test`: Run Jest tests
`build`: Builds the Dev Server Kit and Dev Console app
`lint`: Runs linting
`version-bump`: Version bump
`deploy`: Publishes Dev Server Kit and Dev Conosle
