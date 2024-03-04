# March 2022 - Lazy downloading a fixed version of the extension binary

Before the work on the Shopify CLI 3.0,
the extensions group developed a [CLI](https://github.com/shopify/shopify-cli-extensions)
for building and serving extensions.
It's a Go binary that we downloaded at [installation time](https://github.com/Shopify/shopify-cli/blob/main/ext/shopify-extensions/extconf.rb#L14) in the Shopify CLI 2.0.
The extensions CLI includes a reverse proxy that allows reusing the tunnel connection with multiple HTTP servers,
each serving an extension.

With the re-write of the Shopify CLI in NodeJS and Typescript,
we decided to reuse the existing binary in the first iteration.
However, we changed the download to happen **lazily at runtime** instead of installation time.
The first and most important reason for the change was that a failing download through [pre and post scripts](https://docs.npmjs.com/cli/v8/using-npm/scripts#pre--post-scripts) would leave the CLI's setup under `node_modules` incomplete.
Moreover, we'd rely on the package managers to take the user out of that state,
or what's worse,
users having to delete `node_modules` to force the re-execution of the extensions binary download script.
Moreover,
we wouldn't have error tracking at that phase,
so we'd only know about installation issues through user reports.

In the Shopify CLI 3.0,
the download happens lazily.
The first time the code execution stumbles upon the need for shelling out to the extensions' binary, we download it.
The binary is stored under the `dist/vendor` directory of the `app` package.
The versions of the CLI and tied to versions of the extension binary to ensure determinism.
Pulling the latest version of the extensions' binary would lead to inconsistencies across environments that can make developers spend time debugging issues and figuring out why inconsistencies happen in the first place.

**Note** that we might remove the binary in the future and have all the logic implemented in Node within the Shopify CLI codebase. But until we have a strong case for making such investment, we'll continue to delegate the responsibility to the binary.
