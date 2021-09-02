# Shopify CLI Extensions

`shopify-extensions` is an add-on to the Shopify CLI, which is installed automatically when installing the CLI. It is not meant to be invoked directly. Instead, invocation of `shopify-extensions` occurs through `shopify extension`. Today, `shopify-extensions`' main purpose is to power the experience of `shopify extension serve`, `shopify extension build` and augment `shopify extension create`.

The information below is mainly targeting contributors rather than users. If you want to learn more about how to build extensions and how to use the Shopify CLI in general, please consult the [official documentation](https://shopify.dev/apps/tools/cli).

## Test

To run the tests, simply execute the following shell command:

```sh
make test
```

### Bootstrap an extension

To bootstrap an extension and install of its node dependencies, run:

```sh
make run bootstrap
```

This will create a `checkout_ui_extension` in the `tmp` folder, install the node dependencies and then build the extension.

### Serve

After [boostrapping an extension](#bootstrap-an-extension), you can run the server by execute the following shell command:

```sh
make run serve < testdata/shopifile.yml
```

Subsequently, you should be able to retrieve sample assets as follows:

```sh
curl http://localhost:8000/extensions/00000000-0000-0000-0000-000000000000/assets/index.js
```

## Create

To create a new extension project, simply execute the following shell command:

```sh
make run serve < testdata/shopifile.yml
```

This will create a new extension inside the `tmp/checkout_ui_extension` folder. You can update `testdata/shopifile.yml` if you want to test different options.

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
