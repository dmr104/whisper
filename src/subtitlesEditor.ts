import * as vscode from 'vscode';
import { getNonce } from './util';
import { read } from 'fs';
import { onMyCommandDataEmitter, onMyCommandData } from './extension';

export class subtitlesEditorProvider implements vscode.CustomTextEditorProvider {
    
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new subtitlesEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(subtitlesEditorProvider.viewType, provider,
            {   // webviewPanel.options.retainContextWhenHidden;
                webviewOptions: {
                    retainContextWhenHidden: true,
                    enableFindWidget: true
                },
                supportsMultipleEditorsPerDocument: true, // If you want splits to work seamlessly
            }
        );
		return providerRegistration;
	}

	private static readonly viewType = 'whisperedit.subtitles';
    private eventListenerDisposable: vscode.Disposable | undefined;

	constructor(private readonly context: vscode.ExtensionContext) { 
    }   

    // Map to store sets of webview panels for each document URI
    // This allows multiple webviews (e.g., split views) for the same document
    private documentWebviews = new Map<string, Set<vscode.WebviewPanel>>(); 

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> { 

        // Which is our document for our key?
        const documentUriString = document.uri.toString();

	    // Configure webview options
		webviewPanel.webview.options = {
			enableScripts: true
		};
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        // 5. Listen for the custom event
        // Dispose of any previous listener for this webviewPanel to avoid leaks
        if (this.eventListenerDisposable) {
            this.eventListenerDisposable.dispose();
        }

        this.eventListenerDisposable = onMyCommandData(args => {
            // 6. Post the data to the webview
            webviewPanel.webview.postMessage({
                command: args.command
            });
            console.log('Data received in resolveCustomTextEditor and sent to webview:', args);
        });

        // Clean up the listener when the webview panel is disposed
        webviewPanel.onDidDispose(() => {
            if (this.eventListenerDisposable) {
                this.eventListenerDisposable.dispose();
                this.eventListenerDisposable = undefined;
            }
        });

	    // Setup initial content for the webview
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
                    // vscode.window.showInformationMessage("JSON data read successfully!");
                    // console.log('jsonData is ', jsonData);
    
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

        
        // When a webview wants to modify the data, it uses vscode.postMessage() to send the 
        // proposed changes to the extension.  The extension listens for these messages using 
        // webviewPanel.webview.onDidReceiveMessage().
        webviewPanel.webview.onDidReceiveMessage(
            async message => {
                switch (message.type) {
                    case 'updateText':
                    // The webview has sent updated text content.  Update that content to our data structure here.
                    console.log(message.id, message.textInner, message.textHTML);
                    const data = { id: message.id, textInner: message.textInner, textHTML: message.textHTML };
                    // Now, call the function to process and broadcast the change.
                    // The webview sends its proposed new state for the entire structure.
                    this.onChangeDatastructure(documentUriString, data);

                    case 'webViewReady':
                        vscode.window.showInformationMessage(message.text || 'Webview has signaled it is ready!');
                        // Now that the webview is ready, send the initial content to it.                       
                        initalizeWebview();
                        return;                     
                }
            }
        );               

        // Invoke to bind all our keybindings
        // subtitlesEditorProvider.registerCommands();

    }
    
    private onChangeDatastructure (originatingUri: string, changeData: any) {
        for (const [uri, mySet] of this.documentWebviews.entries()) {
            if (uri === originatingUri) {
                console.log(`Posting update to: ${uri}`);
                for (const panel of mySet){
                    panel.webview.postMessage({ perform: 'updateDataStructureInWebviews', data: changeData });
                }
            }
        }

    } 

    public static registerCommands(): vscode.Disposable {
        const commandDisposables: vscode.Disposable[] = [];

        // Command to trigger button click.  see package.json.  we are sending the args object from it.
            const buttonFromKeyBinding =  vscode.commands.registerCommand('whisperedit.triggerButtonClick', (args) => {
                // webviewPanel.webview.postMessage({ command: args.command });

                // 3. Fire the event with the data
                onMyCommandDataEmitter.fire({ command: args.command });
                vscode.window.showInformationMessage(`triggerButtonClick executed with options ${args.command}`);
        });

        commandDisposables.push(buttonFromKeyBinding);
        // Return a single disposable that cleans up all registered commands when disposed
        // This uses Disposable.from() to combine multiple disposables into one.
        return vscode.Disposable.from(...commandDisposables);   
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

