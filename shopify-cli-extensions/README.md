# Shopify CLI Extensions

`shopify-extensions` is an add-on to the Shopify CLI, which is installed automatically when installing the CLI. It is not meant to be invoked directly. Instead, invocation of `shopify-extensions` occurs through `shopify extension`. Today, `shopify-extensions`' main purpose is to power the experience of `shopify extension serve`, `shopify extension build` and augment `shopify extension create`.

The information below is mainly targeting contributors rather than users. If you want to learn more about how to build extensions and how to use the Shopify CLI in general, please consult the [official documentation](https://shopify.dev/apps/tools/cli).

## Getting started

Prerequisites:

- [Go](https://go.dev/), version 1.17 or higher
- The current [LTS version](https://nodejs.org/en/about/releases/) of [Node.JS](https://nodejs.org/en/)

Install Go by running

```sh
brew install go
```

Install Node.JS by running:

```sh
brew install node
```

> **OPTIONAL**: If you are a Shopify employee, your machine may be configured to use `npm.shopify.io`. To avoid `yarn` errors, install the project by running `dev up`.

Next, familiarize yourself with the `Makefile`. It defines several useful tasks for building and testing the project.

To build the project, bootstrap some example extensions and install all of their dependencies, run:

```sh
make bootstrap
```

This will create extensions in the `tmp/` folder and install the node dependencies. It will also build the Dev Console app. For more information on creating extensions, see [Creating Extensions](#creating-extensions). Next, you can run the server by executing the following shell command:

```sh
make run serve testdata/extension.config.yml
```

Subsequently, you should be able to retrieve sample assets as follows:

```sh
curl http://localhost:8000/extensions/00000000-0000-0000-0000-000000000000/assets/main.js
```

Going to root end point http://localhost:8000 will take you to the Dev Console app.

## Testing

To run the Go and JavaScript Unit tests, simply execute the following shell command:

```sh
make test
```

The project also provides integration tests, which can be executed as follows:

```sh
make integration-test
```

Both sets of tests are executed for all pull-requests and commits to the `main` branch. The automated integration test only tests the integration between the Go and the JavaScript layer. It does not test the integration with Shopify CLI. For information on how to manually test the full end to end flow, see [Testing the integration with the Shopify CLI](#testing-the-integration-with-the-shpoify-cli).

## Releasing

This project contains multiple publishable artifacts: a Go binary and and several Node packages.

### Publishing the Node Packages

To publish the UI Extension Server kit and Node Shopify CLI Extensions, create a new branch. Then do a version bump.

```sh
yarn version-bump
```

Then push up bump, plus changes.

```sh
git push --follow-tags
```

Once the PR for the new branch is merged, you can deploy the packages on [Shipit](https://shipit.shopify.io/shopify/shopify-cli-extensions/production).
Please choose `latest` as the distribution tag in ShipIt if you're deploying a stable version and `next` if you're deploying a pre-release version.
These tags allow developers to reference our libraries without having to specify a particular version.
[Npm Dist Tags](https://docs.npmjs.com/cli/v8/commands/npm-dist-tag) shouldn't be confused with Git Tags, which are created during the release process as well.

### Publishing the Go Binary

Publishing the Go Binary is done through GitHub Releases, which also allows to create a Git tag in the process. Simply create a new [release](https://github.com/Shopify/shopify-cli-extensions/releases/new) and publish it. Subsequently, a GitHub Action will cross-compile the binaries and attach the resulting assets to the release.

## Appendix

### Creating Extensions

To create new extension projects, simply execute the following shell command:

```sh
make run create testdata/extension.config.yml
```

This will create new extensions inside the `tmp` folder. You can update `testdata/extension.config.yml` if you want to test different options.

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

### Testing the integration with the Shopify CLI

The easiest way to test the integration with the [Shopify CLI](https://github.com/Shopify/shopify-cli) is to clone the aforementioned repository and

1. run `rake extensions:install` to download the latest extension server binary and place it in `ext/shopify-extensions`, followed by
2. running `shopify config feature extension_server_beta --enable` to obtain the necessary feature flag.

Afterwards, the following three commands will be executed by the new extension server:

- `shopify extension create`
- `shopify extension serve`
- `shopify extension build`

### DevConsole

#### Build

The build process is taken care of in the dev server build step. You can also run it yourself.

```sh
make bootstrap

# or
yarn build
```

#### Development

The Dev Console needs a built dev server to connect to via a WebSocket.

```sh
# If you haven't already
make bootstrap
```

Then, run the DevConsole app and Dev Server simultaneously when developing for the DevConsole.

```sh
# This will run `make run serve testdata/extension.config.yml` and `yarn start`
make serve-dev testdata/extension.config.yml
```

#### Node Package Commands

- `start`: Start up the DevConsole app
- `test`: Run Jest tests
- `build`: Builds the Dev Server Kit and Dev Console app
- `lint`: Runs linting
- `version-bump`: Version bump
- `deploy`: Publishes Dev Server Kit and Dev Console
