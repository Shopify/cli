# January 2022 - TypeScript rewrite

As you might all know, for the past months the team has put a lot of thought into how the developer experience (DX) using the CLI for building for Shopify should be. It's been a long process of gathering context and different points of view and we finally settled on a decision that I'd like to share with you.

First, we think the **CLI should make easy things easy, and hard things possible**. Unfortunately, the easy things are not easy at the moment. Building for Shopify requires doing a lot of plumbing yourself which involves making decisions, forming opinions, setting up your project's workspace. Users often end up spending their time figuring out cryptic errors and understanding some complexity and internal details of the platform that they get exposed to. **We need their mental energy to go into building.**

**How do we make the easy things easy?** By simplifying the default development experience down to three phases most developers are used to: *clone the repo, install dependencies, run a dev command.*

The current approach to **dependencies** scattered across package.json's has a lot of indirection, can lead to inconsistencies, and places some burden on developers to maintain, update, and set them up in the most efficient way (e.g. using workspaces). Furthermore, the DX is inconsistent across blocks: *naming conventions, formatting, and handling of errors, formatting of output..*. Users experience that when they use the CLI. Note it's hard to see when focused on a small portion of the CLI, but when looked at holistically, it looks very inconsistent.

This led us to the following two decisions that go hand in hand with each other. The new iteration of the CLI, 3.0, will be a re-write in **[Typescript](https://www.typescriptlang.org/) that targets [NodeJS](https://nodejs.org/en/) as a runtime**, and projects will have a single source of truth for the dependencies of all the app blocks, a package.json at the root. Let me connect these decisions with the aforementioned challenges.

The dependency manager will **deterministically resolve and pull the graph of dependencies, and verify its compatibility with the Node environment**. This graph will include the CLI itself which becomes a dependency of the projects. The weak contract through inter-process communication between Ruby and Node is gone and with that all the Ruby logic to inspect the package.json of blocks. Typescript will verify contracts are met, and the dependency managers will surface any incompatibilities.

We'll grow a CLI Typescript-based foundation of tools to achieve more **consistency**. It'll be the place to codify principles around DX. We expect teams to build upon and contribute to that foundation.

Although this rewrite has a **cost**, we would have had to rewrite a lot of components in Ruby because the app cohesive model effort replaces most of the workflows and API interactions that we have currently. **We believe the value this will bring is a great investment** not only for the aforementioned stability (strongly-typed contracts), determinism (dependency manager), and consistency (foundation), but opens the door for new opportunities. To mention some, we can evolve the platform to allow a browser-based developer experience with tools like [Stackblitz](https://stackblitz.com/), align with streamlined workflows like `npx`, `npm init`, and `yarn create` that take care of installing missing pieces to be able to initialize apps, and enable a powerful plugin system to extend the CLI functionality internally and externally.

Note that **we are not closing the door for those developers that want to take control** of their setup and bring their opinions and workflows. In fact, we'll provide them with APIs for that. The CLI will take care of the tunneling, authentication, and pushing their apps, and they'll do the rest. We’ll iterate on the defaults taking users’ feedback as input.

In case you wonder, there are some pieces that can't be rewritten in Typescript. Those are the pieces that depend on [theme-check](https://github.com/shopify/theme-check), which is shared with Rails-based projects. That code will remain in Ruby, and we'll include it in the NPM package. We'll verify that users have Ruby in their environment before shelling out to the theme workflows.

### FAQ

#### You said one of the benefits is type-checking through Typescript. Wouldn’t we get the same benefit in Ruby with Sorbet?

We do within the Shopify CLI but when it crosses the boundary shelling-out to NodeJS process, there’s no tool in place that can verify that the contract is valid. We need to assume semantic versioning is properly done in those other ends. Moreover, Typescript is broadly more adopted in the community which allows us to build upon already-typed community blocks.

#### What if I need a piece of the CLI to be written in a compiled language like Go or Rust?

Through [node-ffi](https://github.com/node-ffi/node-ffi) we can interact with that binary and our team will help you with building and vendoring the binary for the different architectures we support.

#### Will the installation of the CLI bring dependencies that I might not need?

In the first iteration yes. You’ll end up having logic for theme development even if you don’t plan to do theme development. However, we are architecting the CLI to horizontally distribute features with the goal of eventually extracting some pieces into plugins that developers can opt-in.

#### What does it mean for me and the NPM packages I develop for my domain?

In case you are not doing it already, it’s important that you expose a typed interface from your tooling packages that we can directly import and consume. After we release Shopify 3.0 and once we have a solid foundation, we’ll work with you on aligning with that foundation, which is key for providing a consistent experience.

#### Ruby inside an NPM package. Isn’t that odd?

It’s not standard, but NPM packages are containers of files that can have dependencies with other containers and there’s a tool (the dependency manager) that resolves them for you. If we put Ruby code in them and there’s a Ruby interpreter in the system we can run that code.

#### I think a portable binary is a better idea

We explored this idea too. It’s something that works with atomic utilities such as `curl`, `git` and `github-cli`. However, due to the nature of our projects that depend on web tooling we benefit from building upon an NPM graph for the reasons mentioned above. Also, the CLI is IO-bound, which means most of the time is spent coordinating IO operations, so if we can’t really benefit from the portability and the performance Go or Rust would provide, why go down that path?
