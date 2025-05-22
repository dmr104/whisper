import * as vscode from 'vscode';
import { getNonce } from './util';
import { onMyCommandData } from './extension';
import { getWebviewOptions} from './extension';
import { documentWebviews, openDocuments } from './extension';

// Design pattern comes from 
// https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
export class SubtitlesPanel {

    public static readonly viewType = 'whisperedit.subtitlesPanel';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
    private readonly _document: vscode.TextDocument;
	private _disposables: vscode.Disposable[] = [];
    
    private jsonData: any = null;
    // The first time a webview is populated we want to read from the file on disk.
    // When a webview is split we populate the new webview from the one which 
    // was split from.
    // any change to webview -> matching change should be sent to form a matching change in all other webviews.
    // ----------
    // | webview |--
    // ----------  /|\
    //      |       |                           ------
    //     \|/       --------------------------| disk |
    // ----------                               ------
    // | webview |
    // ----------

    // The following are used to keep track of what is the current panel in focus (active panel)
    private static activePanel: vscode.WebviewPanel | undefined;

    private static setActivePanel(panel: vscode.WebviewPanel | undefined) {
        this.activePanel = panel;
    }

    private static getActivePanel(): vscode.WebviewPanel | undefined {
        return this.activePanel;
    }

    private static deleteActivePanel(panel: vscode.WebviewPanel): undefined {
        if (this.activePanel === panel){
            this.activePanel = undefined;
        }
    }

    public static createAndPopulateNewWebviewFromFile(document: vscode.TextDocument, 
        context: vscode.ExtensionContext): vscode.WebviewPanel {
        
        const column = vscode.window.activeTextEditor ?
            vscode.window.activeTextEditor.viewColumn
            : undefined;
        
        const panel = vscode.window.createWebviewPanel(
            SubtitlesPanel.viewType,
            'Webview',
            column || vscode.ViewColumn.One,
            getWebviewOptions(context.extensionUri)
        );
       
        // We need an instance of the surrounding parent class in order to access _getHtmlForWebview 
        // which is a private method. This works because we are not within module level scope but a 
        // public function within said class.  Our class does all its work when we instantiate it.
        const mySubtitlesPanel = new SubtitlesPanel(document, panel, context);

        // This will always be invoked no matter how we got here.  Keep a record of which webpanel is 
        // the active one.
        SubtitlesPanel.setActivePanel(panel);
        console.log('activePanel within createAndPopulateNewWebview is ', SubtitlesPanel.getActivePanel());

        return mySubtitlesPanel._getReturnWebView();  
    }

    public static createAndTrackWebview(document: vscode.TextDocument, context: vscode.ExtensionContext){

        const column = vscode.window.activeTextEditor ?
        vscode.window.activeTextEditor.viewColumn
        : undefined;
        
        const panel = vscode.window.createWebviewPanel(
            SubtitlesPanel.viewType,
            'Webview',
            column || vscode.ViewColumn.One,
            getWebviewOptions(context.extensionUri)
        );

        const splitTheWebview: boolean = true;
        const mySubtitlesPanel = new SubtitlesPanel(document, panel, context, splitTheWebview);
        const uri = document.uri.toString();
        
        if (!documentWebviews.has(uri)) {
            documentWebviews.set(uri, new Set());
        }
        documentWebviews.get(uri)?.add(panel);

        // The webview object itself handles cleanup of its listeners when it is disposed.
        const myWebviewPanel = mySubtitlesPanel._getReturnWebView();
        
        myWebviewPanel.onDidDispose(() => {
            documentWebviews.get(uri)?.delete(panel);
            if (documentWebviews.get(uri)?.size === 0){
                documentWebviews.delete(uri);
            }
        });

        return myWebviewPanel;
    }

	private constructor(document: vscode.TextDocument, panel: vscode.WebviewPanel, 
        context: vscode.ExtensionContext, splitTheWebview?: boolean) {
		this._panel = panel;
		this._extensionUri = context.extensionUri;
        this._document = document;

        // A keybinding press has been received.  Send the command to the webview.
        onMyCommandData((args: any) => {
            this._panel.webview.postMessage({ command: args.command });
        });


		// Webview's content is not triggered by onDidReceiveMessage within createAndPopulateNewWebview. 
		// Therefore we need to invoke the following to extract the same here.
        // Base HTML skeleton with script waiting for postMessage
        this._panel.webview.html = this._getHtmlForWebview(panel.webview);
        

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
        // Focus tracking.  this means we are tracking which panel currently has focus
		this._panel.onDidChangeViewState(
			(e) => {
                if (e.webviewPanel.active){
                SubtitlesPanel.setActivePanel(e.webviewPanel);
                 console.log('activePanel within onDidChangeViewState is ', SubtitlesPanel.getActivePanel());

                } 

				if (this._panel.visible) {
					this._update();
				}
			},
			null,
            // Adds the disposable from the event fired on onDidChangeViewState to this._disposables
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.type) {
                    case 'updateText':
                        // console.log('MESSAGE is ', message);
                        // The webview has sent updated text content.  Update that content to our data structure here.
                        const data = { id: message.id, textInner: message.textInner, textHTML: message.textHTML };
                        // Now, call the function to process and broadcast the change.
                        this._onChangeFromWebview(this._document, this._panel, data);
                    return; 
                    case 'webViewReady':
                        if (!splitTheWebview){
                            this._populateFirstWebviewFromFile(this._document, this._panel);                
                        } else { // The webviewSplit command has been invoked
                           // this._populateAnotherWebviewFromDOM(this._document, this._panel);
                        }
                }
            },
			null,
            // Adds the disposable from the event fired on onDidReceiveMessage to this._disposables
			this._disposables
		);
	}

    private _getReturnWebView() {
        return this._panel;
    };

    private _onChangeFromWebview (document: vscode.TextDocument, panel: vscode.WebviewPanel, data: any){
        panel.webview.postMessage({ perform: 'updateDataStructureInWebviews', data: data });
    }

	public dispose() {
		// Clean up our resources
        SubtitlesPanel.deleteActivePanel(this._panel);
         console.log('activePanel within dispose, after deleteActivePanel, is ', SubtitlesPanel.getActivePanel());

        // Recall that vscode.WebviewPanel has a .dispose() method. 
        // This closes the panel if it were showing and disposes of the resources owned by the webview. 
        // Webview panels are also disposed when the user closes the webview panel. Both cases fire the 
        // onDispose event
		this._panel.dispose();
        console.log('I am being called from dispose!');

		while (this._disposables.length) {
            // Removes the disposable from the event fired on onDidChangeViewState from this._disposables.
            // Recall that disposables have a .dispose() method
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

    private _populateFirstWebviewFromFile (document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
        this._readFromFile(document)
            .then(myJsonData => {
                        // Use the JSON data as needed
                        vscode.window.showInformationMessage("JSON data read successfully first time!");
                        // console.log('myJsonData is ', myJsonData);
        
                        // Send a data from the extension to the webview
                        for (let i=0; i < myJsonData.segments.length; i++){
                            const seg = myJsonData.segments[i];
                            webviewPanel.webview.postMessage({ segment: seg.text, id: seg.id});
                        }
                    })
            .catch(error => {
                    vscode.window.showErrorMessage("Failed to read JSON data.");
                    console.error("Error reading JSON data:", error);
                });

    }

    // private _initializeTheFirstWebview (document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel) {
    //     //console.log("this.singletonInitWebview", this._singletonInitWebview);
    //     if (!this._singletonInitWebview){
    //         this._readFromFile(document)
    //             .then(myJsonData => {
    //                 // Use the JSON data as needed
    //                 vscode.window.showInformationMessage("JSON data read successfully first time!");
    //                 // console.log('myJsonData is ', myJsonData);
    
    //                 // Send a data from the extension to the webview
    //                 for (let i=0; i < myJsonData.segments.length; i++){
    //                     const seg = myJsonData.segments[i];
    //                     webviewPanel.webview.postMessage({ segment: seg.text, id: seg.id});
    //                 }
    //             })
    //             .catch(error => {
    //                 vscode.window.showErrorMessage("Failed to read JSON data.");
    //                 console.error("Error reading JSON data:", error);
    //             });
    //     } 
    //     this._singletonInitWebview = true;
    // }

        // Setup initial content for the webview
    private async _readFromFile(document: vscode.TextDocument): Promise<any> {
        try {
            const data = await vscode.workspace.fs.readFile(document.uri);

            // Read the JSON file from whisper
            const jsonString = data.toString();
            const myJsonData = JSON.parse(jsonString);
            // Make the myJsonData passed by reference to wider scope jsonData to be shared among webviews
            this.jsonData = myJsonData;
            return myJsonData;
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

    // private _onChangeFromWebview (document: vscode.TextDocument, panel: vscode.WebviewPanel, changeData: any) {
    //     for (const [uri, mySet] of documentWebviews.entries()) {
    //         if (uri === document) {
    //             console.log(`Posting update to: ${uri}, changeData is ${changeData.textHTML}`);
    //             for (const webviewPanel of mySet){
    //                 if (webviewPanel !== panel) {
    //                     console.log('TRigger this. ');
    //                     webviewPanel.webview.postMessage({ perform: 'updateDataStructureInWebviews', data: changeData });
    //                 }
    //             }
    //         }
    //     }
    // } 

    private _update() {
        const webview = this._panel.webview;

        vscode.window.showInformationMessage('Instantiation of class was updated');
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
            // Local path to script and css for the webview        
            const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
                this._extensionUri, 'media', 'subtitles.js'));
    
            const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
                this._extensionUri, 'media', 'reset.css'));
    
            const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
                this._extensionUri, 'media', 'vscode.css'));
    
            const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
                this._extensionUri, 'media', 'subtitles.css'));
    
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
                        <button id="changeBtn">Toggle</button>
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