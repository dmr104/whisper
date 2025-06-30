# whisperEdit README

This is the README for your extension "whisperEdit". This extension to vscode takes the output JSON from OpenAI Whisper, allowing the user to view the content of its text fields within one paragraph and edit it. 

**IMPORTANT INFORMATION** -- This extension is __mutatative__ towards your original files.  It does **not** save an original backup copy.  If you want to keep copies of the original you *MUST* manually do this yourself before editing and exporting to file formats.  

I have allowed the user to specify **bold text** via Alt+b, __underline__ via Alt-u, and *italics* via Alt+i.  There is also Undo via Alt+o.  There is a Toggle button within the webview which allows the user to see where the current segment is which is corresponding to timing data chunks.  Alternatively you may wish to not see this for ease of clarity in depicting continuous text.

To open a webview, press **Alt+p**.  This runs the command "whisperedit: Open or switch to subtitles webview".

To split a webview, press **Alt+n**.  This runs the command "whisperedit: split the Webview".

To export a particular file to all the output formats, either run "whisperedit: export out JSON to multiple formats" when the file, or any of the webviews which are current for said file, is in focus; or, within any of said webviews, click on the pencil (export) icon at the left of the screen to obtain a colourful image of some birds and use the "Export" button from there. 

The output formats are:
JSON with formatting html tags like \<strong\>some text \</strong\>,
SRT again with formatting tags,
VTT likewise.  We have a text file with the html formatting tags saved as yourFile.enriched.txt; and one without saved as yourFile.plain.txt.  We have a formatted html file specifically designed to be imported into MSWord; and a tsv file with formatting tags.

## Features

This extension allows the user to open multiple files, of which each may have a number of webviews.  This was particularly irksome to implement programmatically due to the unsophisticated nature of the vscode API, in my opinion.  But I achieved it.

For example, if there is an fileA.json in a folder under your project workspaceX, I have tested the code by putting another fileB.json within the same folder, or within a subfolder, or within a folder within a different workspace.  This alfa testing appears to indicate that the code functions as expected, unless you copy a file for which an existing webview is already open to a different location -- but realistically, the user should really not be attempting this, and I cannot cover all possible use cases. 

If you wish to reset ALL open webviews which have been opened for any of the JSON files, to what was last loaded into memory from the disk (basically from the most recent save), then the vscode command "Developer: Reload webviews" should do this. 

If you click on the explorer icon (in the top-left of the screen) and reveal the SUBTITLES tab within the explorer, then you can see a copy of the text you are changing in real time, in addition to viewing it within the central paragraph.  Isn't that feature neat?

![A screenshot of the running extension](https://dmr104.github.io/whisper/images/Screenshot_booglies_whisper.png)

### Stats

[![Version](https://badgen.net/vs-marketplace/v/dmr104.whisperEdit?label=version&color=blue)](https://marketplace.visualstudio.com/items?itemName=dmr104.whisperEdit)
[![Installs](https://badgen.net/vs-marketplace/i/dmr104.whisperEdit?label=installs&color=green)](https://marketplace.visualstudio.com/items?itemName=dmr104.whisperEdit)
[![Downloads](https://badgen.net/vs-marketplace/d/dmr104.whisperEdit?label=downloads&color=yellow)](https://marketplace.visualstudio.com/items?itemName=dmr104.whisperEdit)
[![Rating](https://badgen.net/vs-marketplace/rating/dmr104.whisperEdit?label=rating&color=red)](https://marketplace.visualstudio.com/items?itemName=dmr104.whisperEdit)

## Requirements

This extension assumes that you have gotten the output JSON file from OpenAI Whisper.  I run this locally.  Be aware that the hardware runs much better with an NVIDIA GPU with at least 4GB of VRAM.  I actually ran it on a CPU only, to generate the files for my audio book, as I made the mistake/oversight of buying an Intel laptop with an Intel GPU.  A google search of "openai whisper install" might assist you.  

## Extension Commands

This extension contributes the following commands:

* `whisperedit.createOrShowWebview`: Do this when you have opened a JSON file via Alt+p.
* `whisperedit.splitWebview`: In case you wish to see the same file again, so you can view one place within it in comparison to another point within it. Do this via Alt+n
* `whisperedit.triggerButtonClick`: An internally used function to receive the keybindings. Don't use this.
* `whisperedit.exportAllFormats`: Do this when you wish to export your changes. It is mututative to your original files.


## Known Issues

* Try not to copy a file for which an existing webview is already open to a different location. It may mangle the filename in the newly opened panel.  Close the webview and the JSON file first.  

* I decided upon a fixed decimal place for the data in the output tsv file as there are 1000 milliseconds in one second.

* Occasionally, in the console, I receive a warning about maximum eventListeners of 10 being exceeded in the extension host environment. I am unable to figure out reliably how this warning is triggered but it is only an occasional warning. It does not worry me too much.  I have used 8 eventListeners in subtitles.js, and 2 in activity_panel.js, and 1 in explorer.js, totalling 11.

## Release Notes

Here follows the release history of whisperedit.  You can file any bug reports if you have a github account at [whisper open source on github](https://github.com/dmr104/whisper/issues).

You can download the source from github at [whisper open source repository](https://github.com/dmr104/whisper).

I included a schema under /schemas because I intermittently, and upon this eventuality, found that the download link for the online json schema was sometimes broken.  This would be no good somewhere in South America or in Africa if the online connectivity broke.  The schema is referenced within .vscode/settings

### 1.0.0

- Initial release of whisperedit, end of June 2025. 

---

## Support the developer

I, David Roderick, have developed this extension to meet my own needs.  But I believe it will be a godsend for journalists and audiobook creators, who record a lot of speech and need a workable way to correct the speech recognition of the machine.  If you wish to support me, you may consider purchasing a copy of a book about political economy I have written by following this link: [skellington publishing](https://dmr104.github.io/skellington/).  I have the copy of a flier sent out for my book here: [flier from a book promoter](https://dmr104.github.io/whisper/markdown/flier) 

I could have charged for the installation of this extension, but I preferred to have a one button solution for the user downloading from the vscode extension marketplace, instead.  I hope to assist to faciliate better the process of journalism in places like Mexico and Nigeria, where journalists are in danger.  I also hope to get across a political message about ideas surrounding the balance of global trade, and how anxieties about the level of exports and imports are not founded within reality and are ecologically pejorative and lead to social poverty.  You can read further about what I am propounding here [link to political commentary](https://dmr104.github.io/whisper/markdown/political_commentary)  

### I hope I have been of assistance to you.

