# Shopify CLI Extensions

## Technical Design

Project champion: Konstantin Tennhard

### Background

Currently, we use a combination of Webpack and Babel for compilation and Webpack Dev Server to serve the compilation artifacts. This solution provides a few challenges:

- Webpack Dev Server has known security vulnerabilities,
- Babel, Webpack and Webpack Dev Server have many external dependencies, and
- Serving an extension requires a Node process that occupies a port.

As long as projects are comprised of a single extension, having a dedicated Node server doesn't pose major challenges. However, as soon as we're trying to run multiple extensions, two major challenges arise:

1. Port selection needs to be centrally coordinated,
1. Making all servers externally available through an HTTP tunnel requires an additional reverse proxy server.

Serving an extension using a dedicated Node server is acceptable as long as projects do not consist of more than one extension, however, in the realm of workspaces, problems arising from different development environment configurations as well as running several servers are multiplied.

Instead of deploying yet another piece of development infrastructure that distributes traffic to the correct Node server, we've been exploring a solution that allows us to ship a single server that coordinates all work.

The prototype can be found here: https://github.com/Shopify/app-extension-experiments/tree/master/esbuild-extension-server

### Scope

#### Phase 1 - MVP

The various parts that will comprise this project are as follows:

1. Server
The server process will be built in Golang due to its proven high performance and ability to handle multiple threads of work, which will make it easy to run multiple extensions at once (with an eye for future-proofing this tool).

The server will be responsible for two major things:

- Parsing configuration options from the Shopify CLI via STDIN (could be via persisted file in the future, or if there is time)
- Watching for changes in the `/build` directory, building (more on build process below), and serving the changes.

The server will expose several REST APIs (TBD):

`GET /extensions/`: list of extensions available in the current project / workspace.
`GET /extensions/:uuid`: get a single extension by registration UUID, redirects to tunnel
`GET /extensions/:uuid/stats|data`: get stats or data for an extension given a UUID

2. Build

The build process will have the following major components:

- A `build.js` file which will contain the configuration needed to build the extension with esbuild
- An `npm|yarn run build` command, which will call the `build.js` file
- A Golang function that will spin up a Node process that will call on `npm|yarn run build`
 - This will require a Golang wrapper to be able to interface with both `npm` and `yarn` seamlessly

3. Integration with Shopify CLI

Various pieces for integration with the Shopify CLI are still a work in process. In a nutshell, the desired vision for integrating with the Shopify CLI is as follows:

- A binary of the `shopify-cli-extensions` package will be shipped with the Shopify CLI. This ensures the Shopify CLI will always have access to a compatible version of the `shopify-cli-extensions` package.
- The Shopify CLI will be responsible for parsing the `.env` and `shopify-cli.yml` files for the relevant data the `shopify-cli-extensions` package will need.

### Open questions / issues

- We may need to support both `ArgoServe` (legacy way of serving extensions) and the `shopify-cli-extensions` package for a pre-determined period of time to give Partners enough time to move to the new version
- Need to look into includig extension templates as part of the `shopify-cli-extensions` binary, so that the executable always has access to a compatible template in order to avoid compatibility issues when changes to the template are made
