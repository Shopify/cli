# Shopify CLI Extensions

`shopify-cli-extensions` is an add-on to the Shopify CLI. Today, its main purpose is to power the experience of `shopify extension serve`, `shopify extension build` and augment `shopify extension create`. However, we will consider expanding its responsibilities in future.

## Getting started

### Test

To run the tests, simply execute the following shell command:

```sh
make test
```

### Set up test extension

To set up a test extension for build purposes, run:

```sh
make run setup-test-extension
```

### Serve

To run the server, simply execute the following shell command:

```sh
make run serve < testdata/shopifile.yml
```

Subsequently, you should be able to retrieve sample assets as follows:

```sh
curl http://localhost:8000/extensions/00000000-0000-0000-0000-000000000000/assets/index.js
```

### Create

To create a new extension project, simply execute the following shell command:

```sh
make run serve < testdata/shopifile.yml
```

This will create a new extension inside the `api/testdata` folder. You can update `testdata/shopifile.yml` if you want to test different options.

The YAML file is in the format of

```yml
extensions:
  - uuid: 00000000-0000-0000-0000-000000000000
    type: TYPE
    development:
      root_dir: "api/testdata"
      build_dir: "build"
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
