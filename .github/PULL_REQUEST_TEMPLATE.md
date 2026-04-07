<!--
  ☝️How to write a good PR title:
  - Prefix it with [Feature] (if applicable)
  - Start with a verb, for example: Add, Delete, Improve, Fix…
  - Give as much context as necessary and as little as possible
  - Use a draft PR while it’s a work in progress
-->

### WHY are these changes introduced?

Fixes #0000 <!-- link to issue if one exists -->

<!--
  Context about the problem that’s being addressed.
-->

### WHAT is this pull request doing?

<!--
  Summary of the changes committed.
  Before / after screenshots appreciated for UI changes.
-->

### How to test your changes?

<!--
  Please, provide steps for the reviewer to test your changes locally.
  You can post a comment with `/snapit` to generate a snapshot of the changes to be tested.
-->

### Post-release steps

<!--
  If changes require post-release steps, for example merging and publishing some documentation changes,
  specify it in this section and add the label "includes-post-release-steps".
  If it doesn't, feel free to remove this section.
-->

### Checklist

- [ ] I've considered possible cross-platform impacts (Mac, Linux, Windows)
- [ ] I've considered possible [documentation](https://shopify.dev) changes
- [ ] I've considered analytics changes to measure impact
- [ ] The change is user-facing, so I've added a changelog entry with `pnpm changeset add`
