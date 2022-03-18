---
title: Release
---

# Release process

## Process

### Adding change sets when opening PRs

When changing any of the packages of the repository,
you'll have to run `yarn changeset add`,
and [changesets](https://github.com/changesets/changesets) will guide you through the process of adding your changes to be included in the next version's changelog.
Note that if you skip this step when you open a PR,
CI will fail and prevent you from merging the PR.

### Creating a new version

When creating a new release,
create a branch with the name of the version,
`vx.y.yz`,
run the command `yarn changeset version`,
commit and push the changes and open a PR.
Changesets will automatically detect the changes and update the `package.json`s and the dependencies between them.
Once the PR is merged,
a developer from Shopify will go ahead and initiate the publishing process that will result in the packages being pushed to the [NPM registry](https://www.npmjs.com/).
