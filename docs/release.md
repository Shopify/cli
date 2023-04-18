# Release process

## Process

### Adding change sets when opening PRs

When changing any of the packages of the repository,
you'll have to run `pnpm changeset add`,
and [changesets](https://github.com/changesets/changesets) will guide you through the process of adding your changes to be included in the next version's changelog.
Note that if you skip this step when you open a PR,
CI will give a warning.

### Creating a new patch version
The steps are:
1. Locate the [opened PR](https://github.com/Shopify/cli/pulls?q=is%3Apr+is%3Aopen+in%3Atitle+%22Version+Packages%22) named **Version Packages - 3.x**. This PR is automatically created with the first merge in a stable branch after a previous release is published. _Changesets_ will automatically detect changes with each merge and update automatically the PR and consequently the `package.json`s and the dependencies between them
2. Verify that the correct version is updated in every `package.json`, <ins>paying special attention that there is no **major** or **minor** bump</ins>. Approve and merge the **Version Packages** PR when all checks have passed
3. Wait until the commit for **Version Packages** becomes <font color="green">green</font> in [the Shipit stack for your branch](https://shipit.shopify.io/shopify/cli) and push the _Deploy_ button.
4. Push again on the _Create deploy_ button to start the deployment. This will publish the CLI packages to the [NPM registry](https://www.npmjs.com/package/@shopify/cli). If there are failures (as it can be flaky), rerun the deployment and the missing packages should be published.
5. Create a new tag with the new version: `git tag 3.x.x && git push --tags`
6. [Create a new release in the CLI repo](https://github.com/Shopify/cli/releases/new):
    * Use the created tag ("3.x.x")
    * Release title: "3.x.x"
    * Description: summary of the most important changes from Version Packages PR
    * Click "Publish release"
7. Only if releasing a patch to the latest stable version: Once the deployment completes, [find the PR](https://github.com/Shopify/homebrew-shopify/pulls?q=is%3Apr+is%3Aopen+Shopify+CLI) in the homebrew-shopify repository and merge the changes in the formula.

### Creating a new pre-release version

This should be done once a week.

1. Find the [Version Packages - main (pre) PR](https://github.com/Shopify/cli/pulls?q=is%3Apr+is%3Aopen+%22Version+Packages+-+main+%28pre%29%22) and merge it.
2. Wait until the commit for **Version Packages - main (pre)** becomes <font color="green">green</font> in [CLI Production Shipit](https://shipit.shopify.io/shopify/cli/production) and push the _Deploy_ button.
3. Push again on the _Create deploy_ button to start the deployment. This will publish the CLI packages to the [NPM registry](https://www.npmjs.com/package/@shopify/cli). If there are failures (as it can be flaky), rerun the deployment and the missing packages should be published.


### Creating a new minor version

First, exit prerelease mode:

1. Pull the latest `main`, check out a branch, and run `pnpm changeset pre exit`.
2. Open a PR to `main`, get approval.
3. Announce in `#shopify-cli` and `#cli-foundations-team` that merges should be paused for release.
4. Merge!

Next, cut the release:

1. Locate the [opened PR](https://github.com/Shopify/cli/pulls?q=is%3Apr+is%3Aopen+in%3Atitle+%22Version+Packages+-+main%22) named **Version Packages - main**. This PR is automatically created with the first merge in `main` after a previous release is published. _Changesets_ will automatically detect changes with each merge to main and update automatically the PR and consequently the `package.json`s and the dependencies between them
2. Verify that the correct version is updated in every _package.json_, <ins>paying special attention that there is no **major** bump</ins>. Approve and merge the **Version Packages - main** PR when all checks have passed.

Now return to prerelease mode:

1. Pull the latest `main`, check out a branch, and run `pnpm changeset pre enter pre`. Commit.
2. Move the contents from `release_notes_draft.md` to a new file, `RELEASE_NOTES/3.x.md`, replacing `3.x` with the actual minor version number. Be sure to leave the comments where they are! Commit.
3. Open a PR to `main`, get approval.
4. Merge!
5. Announce in `#shopify-cli` and `#cli-foundations-team` that the release has been cut, and merges are permitted.

You've designated a commit as releasable. Now time to publish via Shipit:

1. Wait until the commit for **Version Packages - main** becomes <font color="green">green</font> in [CLI Production Shipit](https://shipit.shopify.io/shopify/cli/production) and push the _Deploy_ button.
2. Push again on the _Create deploy_ button to start the deployment. This will publish the CLI packages to the [NPM registry](https://www.npmjs.com/package/@shopify/cli). If there are failures (as it can be flaky), rerun the deployment and the missing packages should be published.
3. Once the deployment completes, [find the auto-generated PR](https://github.com/Shopify/homebrew-shopify/pulls?q=is%3Apr+is%3Aopen+Shopify+CLI) in the homebrew-shopify repository and merge the changes in the formula.
4. Create a new tag with the new version: `git tag 3.x.x && git push --tags`
5. [Create a new release in the CLI repo](https://github.com/Shopify/cli/releases/new):
    * Use the created tag ("3.x.x")
    * Release title: "3.x.x"
    * Description: summary of the most important changes from Version Packages PR
    * Click "Publish release"
6. Go through all the [PRs labeled with `includes-post-release-steps`](https://github.com/Shopify/cli/issues?q=label%3Aincludes-post-release-steps+is%3Aclosed) and:
  1. Follow the post-release steps described in those PRs.
  2. Delete the labels afterward.

Finally, it's time to do a bit of manual shuffling, as we welcome a stable version and deprecate another:

1. Pull the latest `main` and check out the release commit.
2. From there, check out a branch called `stable/3.x` (replacing x with the minor version).
3. In the repo root, run `cp shipit.stable.yml.sample shipit.stable_3_x.yml; git add shipit.stable_3_x.yml; git commit -m "Add stable/3.x shipit configuration"` (replacing x with the minor version each time)
4. Push your branch.
5. [Create a shipit stack](https://shipit.shopify.io/stacks/new), setting branch to `stable/3.x` and environment to `stable_3_x` (replacing x with the minor version each time). The names are VERY IMPORTANT to get right, as they will enable Shipit to find your branch and detect deployable commits!
6. Checkout the previous minor release's `stable/3.x` branch.
7. Open that branch's `shipit.stable_3_x.yml` file and follow the directions in the `deploy.override` comments. This will do 2 things:
    1. Ensure Homebrew always points to the latest stable version
    2. Ensure npm's `@latest` tag always points to the latest stable version
8. Commit and push your changes.
9. If we have decided to label a minor version as end-of-life, find the appropriate stack in [CLI Shipit](https://shipit.shopify.io/shopify/cli) and archive it.
