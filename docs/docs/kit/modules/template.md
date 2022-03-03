---
title: template
---

The `template` modules provide utilities to use the [Liquid template engine](https://shopify.github.io/liquid/) to parse in-memory templates and templates that live in the file system.


### `create`

Create takes the template as an input, and returns a function to parse the template with given data.

```ts
import {template} from "@shopify/cli-kit"

const readmeTemplate = template.create("# {{variable}}")
const readme = await readmeTemplate({variable: "value"})
```

#### Input

| Name | Description | Required | Default |
| --- | -- | --- | --- |
| `templateContent` | The Liquid template | Yes | |

#### Output

It returns a `(data: object) => Promise<string>` function that parses the template with the given data and returns a promise that resolves with the parsed template.

### `recursiveDirectoryCopy`

If you have a directory that represents a template where some files are liquid templates,
you can use this function to copy the template recursively and parse the templates along the process. Liquid templates have the `.liquid` suffix. For example, `README.md.liquid`.

```ts
import { recursiveDirectoryCopy, path } from "@shopify/cli-kit"

const fromDirectory = path.resolve("./input")
const toDirectory = path.resolve("./output")


await recursiveDirectoryCopy(fromDirectory, toDirectory, {variable: "test"})
```

#### Input

| Name | Description | Required | Default |
| --- | -- | --- | --- |
| `from` | The directory that contains the template | Yes | |
| `to` | The output directory into where the template will be parsed | Yes | |
| `data` | The data that will be passed to the Liquid template engine when parsing templates | Yes | |

#### Output

It returns a promise that resolves or errors when the process finishes.
