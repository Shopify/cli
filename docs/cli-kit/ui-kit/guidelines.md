# Content guidelines

It's important to be consistent in how we display content to users of the CLI.
These guidelines should guide you when choosing your style of communication with the users.

## General content guidelines
- Use contractions (ex: can't instead of cannot). It's the easiest way to sound human.
- Use “we” to refer to Shopify. (This "we" framing acts as a trust signal. In the platform context, Shopify and the developer are building value together. We're not slippery; we're not hiding.)

## Prompting user inputs with selection and text prompts:
- A full-sentence question (“Have you installed your app on your dev store?”)
- A text prompt with simple noun followed by a colon (“App name:”)
- A list prompt followed by a colon: (“Select extension type:”)

## Communicating processes with dynamic checkmarks:
- Progress indicators should take this passive voice formula: “Dependencies installed”; “App initialized”; “App deployed”. In other words: 'noun' 'verb' (past participle).

## Content in banners:
- Each of the banner elements can support robust messaging with a next steps section and a reference section with links. The prompt components can also be customized with, for example, headings to group selection options.
- For info banners: Use present perfect tense to describe a significan display  (“The REST API has been deprecated").
- For error messages: Use the present tense to describe what’s happening in the error message context (“Can’t connect to the Storefront API”)
- More examples in the CLI example page. Run <PACKAGEMANAGER> shopify kitchen-sink all
