import * as vscode from 'vscode';
import { getNonce } from './util';

// The following variable is in the global scope because the listener callback onDidChangeActiveTextEditor
// 
// let currentActiveDocument: vscode.TextDocument | undefined;

export function activate(context: vscode.ExtensionContext){
    // WebviewManager is an implementation of vscode.Disposable;  this makes things very convienient as 
    // the disposable done to documentWebviews is managed within it.  the public dispose() method is called when 
    // webviewManager is disposed, and the .onDidDipose within createOrShowView deletes a key-value pair 
    // when the webview becomes closed manually or programmatically individually. 
    // The WebviewManager class contains the variable currentActiveDocument, the instance of which lingers and survives 
    // after the lifetime of the activate function has expired.  This is essential because references to functional 
    // informational state information are kept within the following instances of these classes many of which need 
    // to be referred to AFTER the active() function is completed

    // This is one of the main dudes in our programming arsenal   
    const webviewManager = new WebviewManager();

    // The html for the webview is part of the SubtitlesPanel class. So we need an instance of it. We are creating an html skeleton
    const mySubtitlesPanel = new SubtitlesPanel(context.extensionUri);
    
    const commandDisposable001 = vscode.commands.registerCommand("whisperedit.createOrShowWebview", () => {
                                  // I M P O R T A N T ! ! ! ! 
        // We want that each each webview creation will only happen once.  Thereafter we will 
        // run the command splitWebview if we want another webView by any TextDocument. This is a good 
        // user experience. If the user  runs createOrShowWebview from an active webview then 
        // activeTextEditor becomes the value undefined.

        // This will allow us to decide whether the focus is within a webview or the TextEditor.    
       
        const presentActiveTextEditor: vscode.TextEditor | undefined  = vscode.window.activeTextEditor;
        const presentActiveDocument: vscode.TextDocument | undefined = presentActiveTextEditor?.document;
        const presentActiveDocumentUriString: string | undefined = presentActiveDocument?.uri.toString();

        // We need to extract the first item of the array (which is the value of the key within webviewManager.lastUsedWebview).
        // This is in order to obtain the string which is the first item of the Array within 
        // Map<string, [string, vscode.WebviewPanel]>.  We do this in order to access the recollection of which 
        // was the last active TextEditor selected.  If we have selected a non-TextEditor, i.e. a webviewPanel, then
        // presentActiveDocumentUriString will be undefined and our registerCommand('createOrShowWebview') will return 
        // at this point

        // IMPORTANT USER EXPERIENCE!!!! Whenever the user is within even the primary webview panel or might be 
        // within a secondary webview panel, or a tertiary or a 4th webpanel (basically anything other than the 
        // TextEditor panel) then rather than jumping Webview panels when the createOrShowWebviewPanel command is invoked 
        // the UX will be much smoother where nothing happens upon a createOrShowWebpanel command after we already have 
        // a primary Webview panel.  There should not be any jumping around willy-nilly:  the user experience will be 
        // a stable one, not a cryptic one.  To change the  webview panel the user shall use the mouse or a builtin 
        // command perhaps attached to a keybinding. 
        let viewTypeID: string = "";
        if (!presentActiveTextEditor){  // presentActiveTextEditor is undefined if we are coming from a non-TextEditor 
          return;                       // such as a webview, and the conditional return here is very important as it 
                                        // terminates our command prior to even a SHOW (revealing) to the webview within
        }                               // WebviewManager class 
        
        const returnedValue: ReturnValue = webviewManager.createOrShowWebview(viewTypeID, 'Webview', presentActiveDocumentUriString);
        // our returnedValue is of form 
        // { panel: vscode.WebviewPanel, newlyCreated: boolean, currentlyActiveDocument: vscode.TextDocument | undefined }
        // The function createOrShowWebview returns a bare-bones webviewPanel, which is not containing any html skeleton 
        // or dynamic content
        
        // Extract the boolean part of returnedValue to determine whether this is a shown webview or a newly created one
        const panelIsNewlyCreated: boolean = returnedValue.newlyCreated;

        if (!panelIsNewlyCreated){  // If the panel is not newly created, it existed already, and we have already SHOWN it
            return;                 // Therefore do not proceed processing any further as we are not within a CREATE and 
        }                           // therefore do not wish to populate it

        // OTHERWISE WE ARE ON A CREATE, NOT A SHOW

        // So extract the webpanel part of returnedValue in order to use it as the created bare-bones unpopulated webpanel. 
        const webviewPanel: vscode.WebviewPanel = returnedValue.panel;
    
        // if this is a new panel, populate it with json from whisper output file.  We are using defensive programming here 
        // to check the value of panelIsNewlyCreated, but strictly this logic may be unnecessary
        if (panelIsNewlyCreated){
            // Set up the webview content skeleton from a public function of this instance of webviewPanel.
            webviewPanel.webview.html = mySubtitlesPanel.getHtmlForWebview(webviewPanel.webview);

            // presentActiveDocument was defined as a variable near to the beginning of our 
            // registerCommand('createOrShowWebview'). Its purpose was to store a TextDocument from activeTextEditor.document
            if (presentActiveDocument){
                mySubtitlesPanel.populateWebviewViewFromFile(presentActiveDocument, webviewPanel); 
            }
        }
    });

    context.subscriptions.push(commandDisposable001, webviewManager);
    
}

export function deactivate() {
}

export class SubtitlesPanel {
    private readonly _extensionUri: vscode.Uri;

    constructor(extensionUri: vscode.Uri){
        this._extensionUri = extensionUri;
    }
    
    public getHtmlForWebview(webview: vscode.Webview): string {
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

    public populateWebviewViewFromFile (document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
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

    private async _readFromFile(document: vscode.TextDocument): Promise<any> {
        try {
            const data = await vscode.workspace.fs.readFile(document.uri);

            // Read the JSON file from whisper
            const jsonString = data.toString();
            const myJsonData = JSON.parse(jsonString);
            
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

}

type ReturnValue = { panel: vscode.WebviewPanel, newlyCreated: boolean }

type myMap = Map<string, Set<[string, vscode.WebviewPanel]>>

class WebviewManager implements vscode.Disposable {

    // The following variable keeps a record of the fact that a webviewPanel with this particular viewType (a unique ID) has 
    // been created, and is associated with potentially more other webviewPanels in an association with the TextDocument.

    // documentWebviews is Map < document.uri, Set of webviews >
    public documentWebviews: myMap = new Map<string, Set<[string, vscode.WebviewPanel]>>();

    // We need to write a helper function which will search for a particular webviewPanel within the documentWebviews 
    // structure when we know its viewType ID 
    private findWebviewPanelById(stringId: string, documentWebviews: myMap): vscode.WebviewPanel | undefined {
          for (const [key, webviewSet] of documentWebviews) {
            console.log(`Key: ${key}`);
            
            for (const [id, webviewPanel] of webviewSet) {
                if (id === stringId){
                    return webviewPanel;
                }
                return undefined; 
            }
        }
    }

    // We need to write a helper function which will search for a particular viewType ID within the documentWebviews 
    // structure when we know its webviewPanel
    private findIdByWebviewPanel(panel: vscode.WebviewPanel, documentWebviews: myMap ): string | undefined {
          for (const [key, webviewSet] of documentWebviews) {
            console.log(`Key: ${key}`);
            
            for (const [id, webviewPanel] of webviewSet) {
                if (webviewPanel === panel){
                    return id;
                }
                return undefined; 
            }
        }
    }

    // We need to write a helper function which will add a value to a particular Set within documentWebviews
    private addValueToSet(key: string, value: [string, vscode.WebviewPanel], myMapping: myMap){
        // Check whether the Map already has the key
        if (!myMapping.has(key)) {
            // If not, create a new Set for this key
            myMapping.set(key, new Set<[string, vscode.WebviewPanel]>());
        }
        
        // Retrieve the Set and add the new value
        const webviewSet = myMapping.get(key);
        webviewSet?.add(value); // Use optional chaining to add the value        
    }

    // We need to write a helper function which will delete a value from a particular Set within documentWebviews
    private deleteValueFromSet(key: string, value: [string, vscode.WebviewPanel], myMapping: myMap){
        // Check if the Map has the key
        if (myMapping.has(key)) {
            const webviewSet = myMapping.get(key);
            
            // Use the delete method to remove the value
            if (webviewSet) {
                webviewSet.delete(value);
                
                // Remove the Set from the Map if it's empty
                if (webviewSet.size === 0) {
                    myMapping.delete(key);
                }
            }
        }
    }

    // We need to write a helper function which will return the associated with a particular Set within documentWebviews
    private findKeyByWebviewPanel(webviewPanel: vscode.WebviewPanel, myMapping: myMap): string | undefined {
        for (const [key, webviewSet] of myMapping) {
            for (const [id, panel] of webviewSet) {
                if (panel === webviewPanel) {
                    return key; // Return the key if the WebviewPanel matches
                }
            }
        }
        return undefined; // Return undefined if not found        
    }
    
    // It is a mapping between this ID and the value as the unique viewTypeID, in 
    // order to recall which was the primary webview panel which is to be shown when the corresponding TextEditor for 
    // that particular TextDocument is open.  

    // Otherwise if the TextDocument/TextEditor does NOT have any corresponding primary webview, then create it 
    // with a unique viewTypeID

    // The following is a map to track the last used actual WebviewPanel per document for speedy access referencing.
    // Map < document.uri.toString(), WebviewPanel >  
    public lastUsedWebview: Map<string | undefined, [string | undefined, vscode.WebviewPanel | undefined] | undefined> = new Map();

    // The following variable keeps a record of which was the lastly focused TextEditor.document
    public currentActiveDocument: vscode.TextDocument | undefined = undefined;

    // We need the following counter to create a unique ID (viewType) for each webview.
    private static webviewCounter: number = 1;
    
    public createOrShowWebview(viewType: string, title: string, presentActiveDocumentUriString: string | undefined): ReturnValue {
        // Useful in development
        // this.documentWebviews.forEach((mySet, doc) => { for (const item in mySet) { console.log(doc, item);}} );

        // Out modus operandi is as follows.
        // Check whether panel already exists. If it does we show it, not create it.  
        
        // If the parameter presentActiveDocumentUriString has been passed the argument "as it says on the tin" then we will 
        // look up the corresponding WebviewPanel within lastUsedWebview and return it within an object { Panel: WebviewPanel, 
        // newlyCreated: boolean }, by which this returning till this object shall also indicating to 
        // registerCommand('createOrShowWebview) that we are doing a webview SHOW, not a CREATE

        const existingPanel = this.lastUsedWebview.get(presentActiveDocumentUriString);

        if (existingPanel && existingPanel[1]) { // WE ARE NOW HERE WITHIN WEBVIEW PANEL SHOW!!!!!!!!!!
            existingPanel[1].reveal();
            // The value of presentActiveDocumentUriString predicates upon the fact that when the webview was created
            // the value of this variable presentActiveDocument was set to vscode.window.activeTextEditor?.document
            return { panel: existingPanel[1], newlyCreated: false } ;  // Within Webview Panel SHOW
        }
        // WE ARE NOW NOT ANY LONGER WITHIN WEBVIEW PANEL SHOW!!!!!!
        // THEREFORE WE ARE NOW WITHIN WEBVIEW PANEL CREATE!!!!!
        // We now need to create a unique viewTypeId for the creation to the webview panel, which now ensues 

        // Reminder: we are NOW within WEBVIEW PANEL CREATE!!!!
        const formattedNumber = WebviewManager.webviewCounter.toString().padStart(4, '0');
        console.log(formattedNumber);
        const uniqueViewTypeId = `whisperWebviewPanel${formattedNumber}`; 

        // The panel doesn't already exist. Therefore we need to create it.  Remember that we are creating and returning 
        // a bare-bones webview along with the extra value 'newlyCreated:' (which is a boolean) upon which decisions will 
        // be made within the registering of our command within commandDisposable001
        let panel: vscode.WebviewPanel;
        panel = vscode.window.createWebviewPanel(
            uniqueViewTypeId,
            title,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        
        // increment the class counter for a unique viewType ID
        WebviewManager.webviewCounter++;

        // Handle disposal
        panel.onDidDispose(() => {
                const foundKeyFromThePanel = this.findKeyByWebviewPanel(panel, this.documentWebviews);
                const foundViewTypeIdFromPanel = this.findIdByWebviewPanel(panel, this.documentWebviews);
                if (foundKeyFromThePanel && foundViewTypeIdFromPanel){
                    // clear documentWebViews
                    this.deleteValueFromSet(foundKeyFromThePanel, [foundViewTypeIdFromPanel, panel], this.documentWebviews);
                    // clear lastUsedWebview
                    if (this.lastUsedWebview.has(foundKeyFromThePanel)){
                        const value = this.lastUsedWebview.get(foundKeyFromThePanel);
                        // Check whether the value exists and clear it
                            if (value) {
                                // Clear the array contents
                                value[1] = undefined; // Set the WebviewPanel to undefined

                                // Optionally, you can also clear the string if needed
                                value[0] = undefined; // Set the string to undefined

                                // Set the entry to undefined      
                            this.lastUsedWebview.set(foundKeyFromThePanel, undefined);
                        }                  
                    }
                    this.lastUsedWebview.get(foundKeyFromThePanel);
                }
            }
        );
        
        // Set the currently active document. Only if TextDocument is focused and a webview for it does 
        // not currently exist will currentActiveDocument be set within the instantiation of this class. 
        // Else the webview for it will be shown. The API says "The active editor is the one that currently 
        // has focus or, when none has focus, the one that has changed input most recently.". This is useful
        // to our programming because we have the following scenarios:
        // 1. the focused TextEditor does not have a webview. In this case the currentActiveDocument is set 
        //    to the activeTextEditor
        // 2. the focused TextEditor DOES have a webview.  In this case we have already shown the webview and 
        //    thus never reach this point in the function createOrShowWebview
        // 3. the TextEditor is not focused.  In this case it must be (or it is most probably) that we are 
        //    focused within a webview.  Here the viewType ID of the webviewPanel will have been found 
        //    already, so we will have shown this webviewPanel.webview, and thus never reach this point in 
        //    the code of the createOrShowWebview function 

        // Here is where the magic happens.  The activeTextEditor does indicate which current document is open
        // Reminder: We are still within the WEBPANEL CREATE!! 
        if (vscode.window.activeTextEditor){  // We were within an active editor at this point
            this.currentActiveDocument = vscode.window.activeTextEditor.document;

            // Track the panel.  If we are not within a TextEditor then presumably we are within a webview and 
            // hence the panel is already tracked, and won't become re-tracked again because we will never reach 
            // here having returned at a SHOW instead 
            this.addValueToSet(this.currentActiveDocument.uri.toString(), [uniqueViewTypeId, panel], this.documentWebviews);

            // lastUsedWebview keeps a paired relationship record of which is the primary webview panel for 
            // each TextDocument.  We need this importantly in order to select the primary webview panel from the 
            // TextDocument.  IMPORTANT USER EXPERIENCE!!!! Ought this occur whenever the user is not within the 
            // primary webview panel --- i.e. might be within a secondary webview panel, or the TextEditor panel?
            // Answer is no. Rather than jumping Webview panels the UX would be much smoother if nothing happens upon 
            // a createOrShowWebpanel command after we already have a primary Webview panel.  There should not be any 
            // jumping around willy-nilly:  the user experience should be a stable one, not cryptic.  To change the
            //  webview panel the user shall use the mouse or a builtin command perhaps attached to a keybinding. 
            this.lastUsedWebview.set(this.currentActiveDocument.uri.toString(), [uniqueViewTypeId, panel]);

        }  
        // We were either 
        // 1. Within a webview, hence activeTextEditor === undefined, or 
        // 2. Not within a TextEditor, and so within a webviewPanel; 
        //    Both scenarios/cases are the same, so therefore the code should never arrive here because we will have 
        //    SHOWN prior and returned at that point in the code.
        
        return { panel: panel, newlyCreated: true };
    }

    // Disposes all tracking and cleans up resources 
    public dispose(): void {
        // Dispose all data structures from documentWebviews
        for (const [key, webviewSet] of this.documentWebviews) {
            // Clear all entries in the Set
            webviewSet.clear(); // Remove all entries from the Set
            // Delete the key from the Map
            this.documentWebviews.delete(key); // Delete the entire mapping
        }        

        // Dispose all data structures from lastUsedWebview
        for (const [key, myArray] of this.lastUsedWebview){
            // Check whether the value exists and clear it
                if (myArray) {
                    // Clear the array contents
                    myArray[1] = undefined; // Set the WebviewPanel to undefined

                    // Optionally, you can also clear the string if needed
                    myArray[0] = undefined; // Set the string to undefined

                    // Set the entry to undefined      
                this.lastUsedWebview.set(key, undefined);
            }  
        }
        

        // Clear all maps
        this.documentWebviews.clear();
        this.lastUsedWebview.clear();
    }
}
