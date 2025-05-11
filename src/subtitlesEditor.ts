import * as vscode from 'vscode';
import { getNonce } from './util';
import { read } from 'fs';

export class subtitlesEditorProvider implements vscode.CustomTextEditorProvider {

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new subtitlesEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(subtitlesEditorProvider.viewType, provider,
            { // This is the options object 
                webviewOptions: {
                    retainContextWhenHidden: true,
                    enableFindWidget: true
                }
            }
        );
		return providerRegistration;
	}

	private static readonly viewType = 'whisperedit.subtitles';

	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> { 
        webviewPanel.options.retainContextWhenHidden;
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true
		};
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        async function readFromFile() {
            try {
                const data = await vscode.workspace.fs.readFile(document.uri);

                // Read the JSON file from whisper
                const jsonString = data.toString();
                const jsonData = JSON.parse(jsonString);
                return jsonData;
            } catch (error: unknown) {
                // Use type checking to handle the error
                if (error instanceof Error) {
                    vscode.window.showErrorMessage(`Error reading JSON file: ${error.message}`);
                    console.error("Error reading or parsing file:", error);
                } else {
                vscode.window.showErrorMessage('An unknown error occurred while reading the JSON file.');
                }                                     
                throw error; // Rethrow the error for further handling
            }
        }

        async function initalizeWebview () {
            readFromFile()
                .then(jsonData => {
                    // Use the JSON data as needed
                    vscode.window.showInformationMessage("JSON data read successfully!");
                    console.log('jsonData is ', jsonData);
    
                    // Send a data from the extension to the webview
                    for (let i=0; i < jsonData.segments.length; i++){
                        const seg = jsonData.segments[i];
                        webviewPanel.webview.postMessage({ segment: seg.text, id: seg.id});
                    }
                })
                .catch(error => {
                    vscode.window.showErrorMessage("Failed to read JSON data.");
                    console.error("Error reading JSON data:", error);
                });
        }

        webviewPanel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'webViewReady':
                        vscode.window.showInformationMessage(message.text || 'Webview has signaled it is ready!');

                        // Now that the webview is ready, send the initial content to it.                       
                        initalizeWebview();
                        return;                     
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Invoke to bind all our keybindings
        this.registerCommands(webviewPanel);

    }
    
    private registerCommands(webviewPanel: vscode.WebviewPanel){
        // Command to trigger button click
            const buttonFromKeyBinding =  vscode.commands.registerCommand('whisperedit.triggerButtonClick', (args) => {
                webviewPanel.webview.postMessage({ command: args.command });
                vscode.window.showInformationMessage(`triggerButtonClick executed with options ${args.command}`);
        });
        
        // Handle when the webview panel is closed
        webviewPanel.onDidDispose( () => {
            // Clean up resources, etc.
            console.log('Webview panel closed.');
            buttonFromKeyBinding.dispose();
        },
        null,
        this.context.subscriptions);        
    }
    
    

    /**
	 * Get the static html used for the editor webviews.
	 */
    private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to script and css for the webview        
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'subtitles.js'));

		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'reset.css'));

		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'vscode.css'));

		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'subtitles.css'));

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();

		return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet" />
				<link href="${styleVSCodeUri}" rel="stylesheet" />
                
                
				<link href="${styleMainUri}" rel="stylesheet" />
               

				<title>subtitles</title>
			</head>
			<body>
                <div id="toolbar">
                    <button id="changeBtn">Toggle view</button>
                    <button id="boldBtn">Bold</button>
                    <button id="italicBtn">Italic</button>
                    <button id="underlineBtn">Underline</button>
                    <button id="undoBtn">Undo</button>
                </div> 
                <!-- Here is where stuff gets injected -->               
                <div id="splurge"></div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;            
    }        
}

