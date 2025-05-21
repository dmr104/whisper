// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { SubtitlesPanel } from './subtitlesPanel';
// Define an EventEmitter to handle your custom event
export const onMyCommandDataEmitter = new vscode.EventEmitter<any>();
export const onMyCommandData = onMyCommandDataEmitter.event;

export function activate(context: vscode.ExtensionContext){
    vscode.window.showInformationMessage('BOOGLIES');
    console.log('JSON Webview extension is active');

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
            if (document.languageId === 'json' && document.uri.scheme === 'file') {
                // We cannot 
                // const instantiation = new SubtitlesPanel(webviewPanel, context)
                // here because the webviewPanel does not exist yet.  Therefore we need to use a class method 
                // and define showWebview as public static within SubtitlesPanel class. 
                SubtitlesPanel.createAndShowWebview(document, context);
                // showWebview(document, context);
            }
        })       
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('whisperedit.action.splitWebview', () => {

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

    context.subscriptions.push(
        vscode.commands.registerCommand("whisperedit.openSubtitles", () =>{
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const document = activeEditor.document;
                // Now you can access the document
                SubtitlesPanel.createAndShowWebview(document, context);
                return document;
            } else {
                vscode.window.showInformationMessage('No active text editor found.');
                return null;
            }
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

