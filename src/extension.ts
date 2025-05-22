// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { SubtitlesPanel } from './subtitlesPanel';
import { SubtitlesWebviewViewProvider } from './SubtitlesWebviewProvider';

// what happens if i open two separate json files?  i want the mapping between onDidOpenTextDocument (within 
// extension.ts) and createAndPopulateNewWebview to be stored as an association for each json file which 
// becomes opened.  I need to manage these tuples myself programmatically because there will not be this 
// association already managed when a json file is opened.

// But a TextDocument may have more than one webview.   If you want to associate multiple webviews with a 
// single TextDocument, then using:
export const documentWebviews = new Map<string, Set<vscode.WebviewPanel>>();
// is the correct approach. And yes, you can also maintain a
export const openDocuments = new Map<string, vscode.TextDocument>();
//  if you need to store or reference the original documents independently (e.g., for metadata, state, etc.).

// Define an EventEmitter to handle your custom event
export const onMyCommandDataEmitter = new vscode.EventEmitter<any>();
export const onMyCommandData = onMyCommandDataEmitter.event;

export function activate(context: vscode.ExtensionContext){
    vscode.window.showInformationMessage('BOOGLIES');
    console.log('JSON Webview extension is active');

    // === Track newly opened documents ===
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
            if (document.languageId === 'json' && document.uri.scheme === 'file') {
                const uri = document.uri.toString();

                // Don't forget to clean this up within onDidCloseTextDocument
                openDocuments.set(uri, document);

                if (!documentWebviews.has(uri)){
                    const panel = SubtitlesPanel.createAndPopulateNewWebview(document, context);
                    documentWebviews.set(uri, new Set([panel]));
                }
                // We cannot 
                // const instantiation = new SubtitlesPanel(webviewPanel, context)
                // here because the webviewPanel does not exist yet.  Therefore we need to use a class method 
                // and define showWebview as public static within SubtitlesPanel class. 
                SubtitlesPanel.createAndPopulateNewWebview(document, context);
                // showWebview(document, context);
            }
        })       
    );

    // === Track closed documents as cleanup is needed ===
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument((document) => {
            const uri = document.uri.toString();
            // Remove webviews
            if (documentWebviews.has(uri)){
                const mySet = documentWebviews.get(uri) || undefined;
                if (mySet){
                    for (const p of mySet){ p.dispose(); }
                } else { console.log('mySet is undefined'); }
            } else {
                console.log('documentWebViews is missing key ', uri);
            }

            // Cleanup this Set
            openDocuments.delete(uri);
           
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("whisperedit.openSubtitles", () =>{
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const document = activeEditor.document;
                // Now you can access the document
                SubtitlesPanel.createAndPopulateNewWebview(document, context);
                return document;
            } else {
                vscode.window.showInformationMessage('No active text editor found.');
                return null;
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('whisperedit.splitWebview', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor){
                const document = editor.document;
                const uri = document.uri.toString();

                openDocuments.set(uri, document); // In case it wasn't caught before

                SubtitlesPanel.createAndTrackWebview(document, context);
            } else {
                vscode.window.showInformationMessage('No active editor');
            }
        })
    );

    context.subscriptions.push(
        // Command to trigger button click.  see package.json.  we are sending the args object from it.
		vscode.commands.registerCommand('whisperedit.triggerButtonClick', (args) => {
			// Fire the event with the data
			onMyCommandDataEmitter.fire({ command: args.command });
			vscode.window.showInformationMessage(`triggerButtonClick executed with options ${args.command}`);
			
	})
    );

    // We need this disposable in the following two commands
    const theWebviewViewProvider = new SubtitlesWebviewViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SubtitlesWebviewViewProvider.viewType, theWebviewViewProvider)
    );

    // Register a command that can update the webview's content
    context.subscriptions.push(
        vscode.commands.registerCommand('whisperedit.updateWebviewData', () => {
            const randomNumber = Math.floor(Math.random() * 100);
            theWebviewViewProvider.updateData(`Updated data from command: ${randomNumber}`);
            vscode.window.showInformationMessage('Webview data updated by command!');
        })
    );

}

export function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewPanelOptions & vscode.WebviewOptions{
	return {
            // Controls whether the find widget is enabled in the panel.
            enableFindWidget: true,
            // Enable javascript in the webview
			enableScripts: true,
            // And restrict the webview to only loading content from our extension's `media` directory.
		    localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
		};
}



// *********************************  delete from here

function showWebview(document: vscode.TextDocument, context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'whisperedit.viewer',
        'subtitles viewer',
        vscode.ViewColumn.Beside,
        getWebviewOptions(context.extensionUri)
    );

    // Base HTML skeleton with script waiting for postMessage
    panel.webview.html = getWebviewHtml(panel.webview);

    panel.webview.onDidReceiveMessage((message) => {
        if (message.command === 'ready') {
            panel.webview.postMessage({
                command: 'load',
                uri: document.uri.toString(),
                content: document.getText()
            });
        }
    });
}

function getWebviewHtml(webview: vscode.Webview): string {
    return /* html */ `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>JSON Webview</title>
        </head>
        <body>
            <h2>JSON Viewer</h2>
            <pre id="jsonContent">Loading...</pre>
            <script>
                const vscode = acquireVsCodeApi();
                vscode.postMessage({ command: 'ready' });

                window.addEventListener('message', event => {
                    const { command, content, uri } = event.data;
                    if (command === 'load') {
                        document.getElementById('jsonContent').textContent =
                            'File: ' + uri + '\\n\\n' + content;
                    }
                });
            </script>
        </body>
        </html>`;
}

