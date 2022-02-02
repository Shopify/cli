---
title: Architecture
---

The Shopify CLI is written in [Typescript](https://www.typescriptlang.org/) and targets Node versions above 12.
We settled on a **Javascript-based** stack because it aligns with the programming language used to build for the platform,
and allows having a strongly-typed contract with web tooling that's necessary to compile and optimize projects for deployment.
It's designed following a **modular** architecture where the bottom-most layer represents the foundation that all the features build upon,
and the top-most layer represents an horizontally-distributed set of features that users can opt into based on their needs.
Modularization also encourages clearly defined boundaries that leads to a better structure that's easier to maintain long-term.

## Modules (packages)

It's important to understand the responsibility of each of the packages to ensure new code is placed in the right package,
and that you can find the component you are looking for more easily. The image below shows an overview of the stack:

<div style={{textAlign: 'center'}}>
  <img
    src={require('./assets/stack.png').default}
    alt="Example banner"
    width="500"
  />
</div>

<br/>

| Package | Description | Examples |
| ------- | ----------- | ------ |
| @shopify/create-app | Contains an executable that guides the user through the process of creating a new Shopify app | Executable |
| @shopify/cli | Contains the CLI executable that glues all the commands provided by the features under it | Executable |
| @shopify/app | Contains the logic for creating, building, serving, and deploying Shopify apps | Commands, App model, Deployment tool. |
| @shopify/theme |  Contains the logic for creating, building, and pushing themes. Note the logic in this package is Ruby. | Commands, Theme server and checker. |
| @shopify/cli-kit | Contains models and utilities that are shared across all the features | Authentication handler, Admin API Client, Session manager. |
