import * as vscode from 'vscode';
import { getNonce } from './util';
import { onMyCommandData } from './extension';
// import { setActivePanel, getActivePanel, deleteActivePanel } from './extension';
import { getWebviewOptions} from './extension';

export class SubtitlesPanel {

    public static readonly viewType = 'whisperedit.subtitlesPanel';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
    private readonly _document: vscode.TextDocument;
	private _disposables: vscode.Disposable[] = [];

    private singletonInitWebview: boolean = false;
    private jsonData: any = null;
    // The first time a webview is populated we want to read from the file on disk.
    // The following variable is used to control this singleton behaviour of readfile() within
    // the function initializeWebView.  We want jsonData to be in a scope which is available to 
    // all webviews. When a webview is split however we populate the new webview from the one which 
    // was split from.
    // any change to webview -> matching change should be sent to form a matching change in all other webviews.
    // ----------
    // | webview |--
    // ----------  /|\
    //      |       |       ----------          ------
    //     \|/       ------| jsonData |--------| disk |
    // ----------           ----------          ------
    // | webview |
    // ----------

    // The following are used to keep track of what is the current panel in focus (active panel)
    private _activePanel: vscode.WebviewPanel | undefined;

    private _setActivePanel(panel: vscode.WebviewPanel | undefined) {
        this._activePanel = panel;
    }

    private getActivePanel(): vscode.WebviewPanel | undefined {
        return this._activePanel;
    }

    private deleteActivePanel(panel: vscode.WebviewPanel): undefined {
        if (this._activePanel === panel){
            this._activePanel = undefined;
        }
    }

    public static createAndShowWebview(document: vscode.TextDocument, context: vscode.ExtensionContext): void {
        
        const column = vscode.window.activeTextEditor ?
            vscode.window.activeTextEditor.viewColumn
            : undefined;
        
        const panel = vscode.window.createWebviewPanel(
            SubtitlesPanel.viewType,
            'Another webview',
            column || vscode.ViewColumn.One,
            getWebviewOptions(context.extensionUri)
        );
       
        // We need an instance of the surrounding parent class in order to access _getHtmlForWebview 
        // which is a private method. This works because we are not within module level scope but a 
        // public function within said class.  Our class does all its work when we instantiate it.
        const mySubtitlesPanel = new SubtitlesPanel(document, panel, context);

        // Base HTML skeleton with script waiting for postMessage
        panel.webview.html = mySubtitlesPanel._getHtmlForWebview(panel.webview);
        
        panel.webview.onDidReceiveMessage((message) => {
            if (message = 'webViewReady') {
                // Populate the DOM of the first opened webview
                mySubtitlesPanel._initializeTheFirstWebview(document, panel);                
            }
        });
        
    }

	private constructor(document: vscode.TextDocument, panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
		this._panel = panel;
		this._extensionUri = context.extensionUri;
        this._document = document;

        // A keybinding press has been received.  Send the command to the webview.
        onMyCommandData((args: any) => {
            this._panel.webview.postMessage({ command: args.command });
        });


		// Set the webview's initial html content
		// this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this._dispose(), null, this._disposables);

		// Update the content based on view changes
        // Focus tracking.  this means we are tracking which panel currently has focus
		this._panel.onDidChangeViewState(
			(e) => {
                if (e.webviewPanel.active){
                this._setActivePanel(e.webviewPanel);
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
                }
            },
			null,
            // Adds the disposable from the event fired on onDidReceiveMessage to this._disposables
			this._disposables
		);
	}

    private _onChangeFromWebview (document: vscode.TextDocument, panel: vscode.WebviewPanel, data: any){
        panel.webview.postMessage({ perform: 'updateDataStructureInWebviews', data: data });
    }

	private _dispose() {

		// Clean up our resources
        // Recall that vscode.WebviewPanel has a .dispose() method. 
        // This closes the panel if it were showing and disposes of the resources owned by the webview. 
        // Webview panels are also disposed when the user closes the webview panel. Both cases fire the onDispose event
		//this._panel.dispose();

		while (this._disposables.length) {
            // Removes the disposable from the event fired on onDidChangeViewState from this._disposables.
            // Recall that disposables have a .dispose() method
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

    private _initializeTheFirstWebview (document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel) {
        if (!this.singletonInitWebview){
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
        } else {
                vscode.window.showInformationMessage("JSON data read twice!");
                for (let i=0; i < this.jsonData.segments.length; i++){
                    const seg = this.jsonData.segments[i];
                    webviewPanel.webview.postMessage({ segment: seg.text, id: seg.id});
                }               
            this.singletonInitWebview = true;
        }
    }

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
        // this._updateForPanel(webview);

        vscode.window.showInformationMessage('Instantiation of class was updated');
    }

	private _updateForPanel(webview: vscode.Webview) {
		this._panel.webview.html = this._getHtmlForWebview(webview);
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