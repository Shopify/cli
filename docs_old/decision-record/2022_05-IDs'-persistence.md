# May 2022 - IDs' persistence

Initial user testing showed that the configuration files are not the ideal place for storing extensions and app identifiers during development.
Since it's common for every developer to use different apps, persisting the ids in the configuration files leads to git diffs that developers
might end up including in their commits by mistake. This led us to revisit our approach.

When **dev'ing**, we persist the application id (i.e. API key) in a global cache and associated to the project's directory so that we can reuse it across runs.
We don't need to persist extensions' ids because we can generate random ids whose lifecycle is tied to the dev command's.

When **deploying**, we persist the ids in a `.env` file at the root of the app to share them across all the environments from where deployments happen,
and ensure all deploys target the same production Partners' App.
Storing the ids in a `.env` file to decide whether or not they want to include it in the Git repository,
and set the value in CI/CD environments through environment variables.

In the future we might interate on the `.env` idea to support deployment to environments other than production.
