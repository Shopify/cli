The vast majority of the UI, including CLI plugins, is to be built using our CLI design system. This ensures a familiar-feeling interction patterns and reduces the complexity behind-the-scenes. It also helps our teams work faster and rely on validation rules

Components include:

| Component  | Purpose |
| ------------- | ------------- |
| info banner  | Convey discrete information that's good to know, but not blocking the workflow at hand.  |
| success banner | Confirm that a major action has taken place and (optionally) suggest next steps. |
| error banner | Explain a blocking problem, then give suggestions for fixing it.
| warning banner | Alert the user to something that will likely become a blocking problem if not addressed. |
| external error intro | Frame external error messages from other tools so that the user understands where they're coming from. |
| selection prompt | Prompt the user to select one option from a list. |
| text prompt | Prompt the user to enter text, such as a project name. |
| dynamic checkmarks | Update the user about a set of processes running in the background, so that system processes don't feel like a black box. |
| shimmer bar | Communicate that a longer process — such as cloning a theme — is taking place.


# Content guidelines

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
- More examples in the CLI example page. Run <PACKAGEMANAGER> shopify kitchen-siink
