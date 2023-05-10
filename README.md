# Jarvis

<img src=img/jarvis-logo-circle.png width=70> [![DOI](https://zenodo.org/badge/568521268.svg)](https://zenodo.org/badge/latestdoi/568521268)

Jarvis (Joplin Assistant Running a Very Intelligent System) is an AI note-taking assistant for [Joplin](https://joplinapp.org), powered by OpenAI's LLM models (such as GPT-3, ChatGPT or GPT-4). You can chat with it, use your notes as additional context in the chat, perform semantic search, or compile an [automatic review of the scientific literature](https://medium.com/@alondmnt/ai-powered-literature-review-6918ee180304). You will need an OpenAI account for Jarvis to work.

<img src="img/jarvis-research.gif" width="450">

## Usage

- **Chat:**
    - Start a new note, or continue an existing conversation in a saved note. Place the cursor after your prompt and run the command `Chat with Jarvis` (from the toolbar or Tools/Jarvis menu). Each time you run the command Jarvis will append its response to the note at the current cursor position (given the previous content that both of you created). If you don't like the response, run the command again to replace it with a new one.
- **Chat with your notes:**
    - To add additional context to your conversation based on your notes, repeat the steps above but select the command `Chat with your notes` (from the Tools/Jarvis menu) instead. Relevant short excerpts of your notes will be sent to OpenAI in addition to the usual conversation prompt / context. To exclude certain notes from this feature, add the tag `#exclude.from.jarvis` to the notes you wish to exclude. You may switch between regular chat and note-based chat on the same note.
- **Related notes:**
    - Find notes based on semantic similarity to the currently open note, or to selected text. This is done locally (offline), without sending the content of your notes to a remote server. Notes are displayed in a dedicated panel. To run semantic search based on selected text, click on the `Find related notes` (toolbar button or context menu option).
- **Literature review:**
    - Run the command `Research with Jarvis`, write what you're interested in, and optionally adjust the search parameters (high `max tokens` setting is recommended). Wait 2-3 minutes for all the output to appear in the note (depending on internet traffic). Jarvis will update the content as it finds new information on the web (using Semantic Scholar, Crossref, Elsevier, Springer & Wikipedia databases). In the end you will get a report with the following sections: title, prompt, research questions, queries, references, review and follow-up questions. For more information see [this post](https://medium.com/@alondmnt/ai-powered-literature-review-6918ee180304).
- **Autocomplete anything:**
    - `Chat with Jarvis` will try to extend any content. Therefore, this essentially serves as a general-purpose autocomplete command. You can remove the speaker attribution ("User:") by cleaning the `response suffix` field in the settings.
- **Text generation:**
    - Run the command `Ask Jarvis` and write your query in the pop-up window, or select a prompt text in the editor before running the command. You can also enhance your query with predefined (or customized) prompt templates from the dropdown lists.
- **Text editing:**
    - Select a text to edit, run the command `Edit selection with Jarvis` and write your instructions in the pop-up window.

## Installation

1. Install Jarvis from Joplin's plugin marketplace, or download it from [github](https://github.com/alondmnt/joplin-plugin-jarvis/releases).
2. Setup your [OpenAI account](https://platform.openai.com/signup).
3. Enter your [API key](https://platform.openai.com/account/api-keys) in the plugin settings page.
4. To make Jarvis more verbose and improve chat coherence, it is recommended to increase `max_tokens` (e.g., to 4000) and `memory_tokens` (e.g., to 500-1000). Note that these settings increase query costs.
5. For literature reviews, you can optionally add free API keys for [Scopus/Elsevier](https://dev.elsevier.com/) as an additional powerful search engine and paper repository, and [Springer](https://dev.springernature.com/) as another paper repository. It is recommended to try both Scopus and Semantic Scholar as each has its pros and cons.

## Disclaimer

- This plugin sends your queries to OpenAI (and only to it). Research queries are also sent to the selected literature search engine (Semantic Scholar / Scopus).
- This plugin uses your OpenAI API key in order to do so (and uses it for this sole purpose).
- You may incur charges (if you are a paying user) from OpenAI by using this plugin.
- Therefore, always check your usage statistics on OpenAI periodically.
- It is also recommended to rotate your API key occasionally.
- The developer is not affiliated with OpenAI in any way.

## Future directions

- Add resampling techniques to improve output.
- Add support for other AI models.
