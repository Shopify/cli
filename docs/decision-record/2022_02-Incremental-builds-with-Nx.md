# February 2022 - Incremental builds with Nx

Up to this point,
the execution of the CLIs in development required doing clean builds of the CLIs and its dependencies through [Rollup](https://rollupjs.org/).
The consequence of that was **longer development cycles**,
which is intimately connected to the experience contributing to the project.

To improve the experience,
we introduced a build system,
[Nx](https://nx.dev/),
which provides **incremental builds** by leveraging the dependency graph and the file changes.
Moreover,
the provides an [affected](https://nx.dev/using-nx/affected) command to run a certain script only for the packages that are affected by the changes.
The same idea can also be leveraged in [continuous integration](https://nx.dev/ci/monorepo-ci-github-actions) to only build, test, and lint the packages that are affected by the changes.
By doing so we also shorten the CI cycles.


### Alernatives considered

Instead of using Nx,
we could have implemented incremental builds and selective task execution ourselves by parsing and extracting information from the graph,
but that'd have come with additional complexity and ongoing maintenance cost.
The Nx setup is very simple,
the tool is well maintained and documented with an active community,
and the tests that we did yielded very promising results.
