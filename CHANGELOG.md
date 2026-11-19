# Change Log

All notable changes to the "whisperedit" extension will be documented in this file.

## 1. Initial release 1.0.0, July 2025

I have not included unit tests or integration tests.

## 2. Bug fixes and feature update in 1.1.0, November 2026

### There was a minor but significant bug whereby html characters such as "$nbsp;" got written into the data that the extension was outputting.  This bug remained in existence until now. It is now fixed, and hopefully other html characters, such as "$gt;" should not appear in the data output neither.

I subsequently have fixed a tonne of these, such as:
```ts
const htmlEscapeCharMap: Record<string, string> = { "&nbsp;": " ", "&lt;": "<", "&gt;": ">", "&amp;": "&", "`": "\`", "{": "\{", "}": "\}" };
const regexHtmlEscape = new RegExp(Object.keys(htmlEscapeCharMap).join("|"), "g");
```
The normal characters (not initiated by an ampersand) were breaking both strings and json structures.  Working now.

---

#### NEW FEATURE ALERT!!!

### You can now control the size of the font within the webview.  Within your working folder (the folder open within your workspace) add the file `settings.json` with the following user-definable content:
```json
{
    "whisperEdit.webviewFontSize": 14
}
```
Alternatively, open the command palette (Ctrl+shift+p), and open "Preferences: Open User Settings (JSON)", and insert `"whisperEdit.webviewFontSize": 14` there. It may be preferrable to keep this close to a visible size close to the `"editor.fontSize"` (which it will default to otherwise, if no whisperEdit.webviewFontSize is set) because this way when you do Ctrl+'+', or Ctrl+'-', altering the text size in the browser, the discrepancy between the ratio changes will not be too much.  Under the hood, within `extension.ts`, I have set this up as:
```ts
const config = vscode.workspace.getConfiguration('whisperEdit');
const myWebviewFontSize: number = config.get<number>('webviewFontSize', 0);
const fontSize: number | string = myWebviewFontSize > 0 ? `${myWebviewFontSize}px` : 'var(--vscode-editor-font-size)';
```
You may need to run `Developer: Reload Window` from the Command Palette for this to have taken effect.

#### I have also found and corrected a bug whereby if the totality of all the content from a div was deleted, the div would disappear from the webview, both vanishing erroneously, and misleading the user into thinking that its content would be deleted: which it was not. Now it is, and the div does not disappear, but remains.  This is well and good.

#### Another thing I have corrected is such that when the user exports all formats, whereby one of these formats is html, a comment beginning and ending in < or >, such as `<put comment here>`, will be transmuted into the html output format as `&lt;put comment here>`. But other formatting such as `<strong>`, `<u>`, and `<em>` will be preserved as formatting tags for the html viewer.  The ground truth for this remark will be found within the json file as `\u003c\u200cput comment here>`, whereby the '\u003c\u200' gets rendered by the vscode editor usually into some rendition of viewing the unicode characters. From this ground truth, these unicode characters are transmuted into `&lt;put comment here>` within the output html.  I chose this because most html readers, and in particular MSWord will not choke upon the `>` character, but a `<` character is interpreted as starting a tab, and would result into text becoming invisible and disappearing within MSWord otherwise.  This appears to work, so let's call it a new feature!  The code which implements this within `extension.ts` is as:
```ts
let myMainJsonDataRecord = mainJsonDataRecord.text.replace(/\u003c\u200c/g, '&lt;');
myMainJsonDataRecord = myMainJsonDataRecord.replace(/(\s+)(?:<)+(\s+)/g, '$1&lt;$2'); // for "some < stuff"
```
# The project now appears to be of production-ready quality.  Okay.  Let's rock and roll.