import * as vscode from 'vscode';
import { getNonce } from './util';
import { isAnyArrayBuffer } from 'util/types';

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

        // We need to extract the first item of the array (which is the value of the key within webviewManager.primaryWebviewForDocument).
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
        let viewType: string = "whisperWebviewPanel";
        if (!presentActiveTextEditor){  // presentActiveTextEditor is undefined if we are coming from a non-TextEditor 
          return;                       // such as a webview, and the conditional return here is very important as it 
                                        // terminates our command prior to even a SHOW (revealing) to the webview within
        }                               // WebviewManager class 
        
        const returnedValue: ReturnValue = webviewManager.createOrShowWebview(viewType, 'Webview', presentActiveDocumentUriString);
        // our returnedValue is of form 
        // { panel: vscode.WebviewPanel, newlyCreated: boolean}
        // The function createOrShowWebview returns a bare-bones webviewPanel, which is not containing any html skeleton 
        // or dynamic content
        
        // Extract the boolean part of returnedValue to determine whether this is a shown webview or a newly created one
        const panelIsNewlyCreated: boolean = returnedValue.newlyCreated;

        if (!panelIsNewlyCreated){  // If the panel is not newly created, it existed already, and we have already SHOWN it.
            return;                 // Therefore do not proceed processing any further as we are not within a CREATE and 
        }                           // therefore do not wish to populate it

        // OTHERWISE WE ARE ON A CREATE, NOT A SHOW

        // So extract the webpanel part of returnedValue in order to use it as the created bare-bones unpopulated webpanel. 
        const webviewPanel: vscode.WebviewPanel = returnedValue.panel;

        // We will also need the following
        const uniqueViewTypeId: string = returnedValue.uniqueViewTypeId;


        // Set up message listener BEFORE setting HTML.  The disposable will be pushed onto context.subscriptions.push()
        // and therefore will be automatically cleaned up
        webviewPanel.webview.onDidReceiveMessage(
            message => {
                switch (message.type){
                    case 'webviewReady':
                    // Now it's safe to populate the DOM
                    // presentActiveDocument was defined as a variable near to the beginning of our 
                    // registerCommand('createOrShowWebview'). Its purpose was to store a TextDocument from activeTextEditor.document
                    if (presentActiveDocument){
                        mySubtitlesPanel.populateWebviewFromFile(presentActiveDocument, webviewPanel); 
                    }
                    break;                        
                }
            },
            undefined,
            context.subscriptions
        );
    
        // if this is a new panel, populate it with json from whisper output file.  We are using defensive programming here 
        // to check the value of panelIsNewlyCreated, but strictly this logic may be unnecessary
        if (panelIsNewlyCreated) {
            // Set up the webview content skeleton from a public function of this instance of webviewPanel.
            webviewPanel.webview.html = mySubtitlesPanel.getHtmlForWebview(webviewPanel.webview);
        }

        // Now we must set
        webviewManager.activeWebviewForDocument.set(presentActiveDocumentUriString, [uniqueViewTypeId, webviewPanel ]);
    });

    const eventListenerDisposable001 = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor){
            webviewManager.transientActiveDocumentUriString = editor.document.uri.toString();
        }
    });
    
    const commandDisposable002 = vscode.commands.registerCommand('whisperedit.splitWebview', () => {

        let viewType: string = "whisperWebviewPanel";

        let returnedFromSplitPanel: { panelFrom: vscode.WebviewPanel | undefined; panelTo: vscode.WebviewPanel } = webviewManager.splitWebview(viewType, 'Webview');
        
        const panelNew: vscode.WebviewPanel = returnedFromSplitPanel.panelTo;
        const panelFrom: vscode.WebviewPanel | undefined = returnedFromSplitPanel.panelFrom;

        // Set up message listener BEFORE setting HTML.  The disposable will be pushed onto context.subscriptions.push()
        // and therefore will be automatically cleaned up
        panelNew.webview.onDidReceiveMessage( 
            message => {
                switch (message.type){
                    case 'webviewReady':
                    // Now it's safe to populate the DOM
                    // mySubtitlesPanel.populateWebviewFromDOM(panelFrom, panelNew); 
                    break;                        
                }
            },
            undefined,
            context.subscriptions             
        );

        panelNew.webview.html = mySubtitlesPanel.getHtmlForWebview(panelNew.webview);

        // We can set a disposable onDidChangeViewState upon the webviewPanel panelNew
    });

    const commandDisposable003 = vscode.commands.registerCommand('whisperedit.triggerButtonClick', (args) => {
    // We want to invoke the commands as specified from package.json by the relevant webview only.  Each has a 
    // unique webviewId. We have access to the currentDocument which as TextDocumentUriString stored in 
    // webviewManager.currentActiveDocument and the currently active webview for this TextDocument, which is 
    // stored within the mapping webviewManager.activeWebviewForDocument. So lets get this activeWebviewForDocument
    // and issue it with the data of each command each time its associated keypress happens.

        let anArray;
        // Firstly, grab the current DocumentUriString
        if (webviewManager.currentActiveDocument){
            const theTextEditorClickedLast = webviewManager.currentActiveDocument; 
            const theTextDocumentUriString = theTextEditorClickedLast.uri.toString();
            // Now we need to acquire the most active webview associated with this TextDocument
            anArray = webviewManager.activeWebviewForDocument.get(theTextDocumentUriString);
        }
        
        let theWebviewPanel: vscode.WebviewPanel | undefined;
        if (anArray) {
            theWebviewPanel = anArray[1]; 
        }

        // A bound press has been pressed.  Send the command to the webview.
        theWebviewPanel?.webview.postMessage({ command: args.command });
        
        vscode.window.showInformationMessage(`triggerButtonClick executed with options ${args.command}`);

	});


    context.subscriptions.push(webviewManager, mySubtitlesPanel, commandDisposable001, 
        eventListenerDisposable001 ,commandDisposable002, commandDisposable003);
    
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

    public populateWebviewFromFile (document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
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

    public dispose(){
    }
}

type ReturnValue = { uniqueViewTypeId: string, panel: vscode.WebviewPanel, newlyCreated: boolean }

type myMap = Map<string, Set<[string, vscode.WebviewPanel]>>

class WebviewManager implements vscode.Disposable {

    // The following variable is set within onDidChangeActiveEditor within eventListenerDisposable001 within activate function
    public transientActiveDocumentUriString: string = "";

    // The following variable keeps a record of the fact that a webviewPanel with this particular viewType (a unique ID) has 
    // been created, and is associated with potentially more other webviewPanels in an association with the TextDocument.

    // documentWebviews is Map < document.uri, Set of webviews >
    public documentWebviews: myMap = new Map<string, Set<[string, vscode.WebviewPanel]>>();

    // We need to write a helper function which will search for a particular webviewPanel within the documentWebviews 
    // structure when we know its viewType ID 
    private findWebviewPanelByIdFromDocumentWebviews(stringId: string, documentWebviews: myMap): vscode.WebviewPanel | undefined {
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
    private findIdByWebviewPanelFromDocumentWebviews(panel: vscode.WebviewPanel, documentWebviews: myMap ): string | undefined {
          for (const [key, webviewSet] of documentWebviews) {
            
            for (const [id, webviewPanel] of webviewSet) {
                if (webviewPanel === panel){
                    return id;
                }
                return undefined; 
            }
        }
    }

    // We need to write a helper function which will add a value to a particular Set within documentWebviews
    private addValueToSetOfDocumentWebviews(key: string, value: [string, vscode.WebviewPanel], myMapping: myMap){
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
    private deleteValueFromSetOfDocumentWebviews(key: string, value: [string, vscode.WebviewPanel], myMapping: myMap){
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
    private findKeyByWebviewPanelFromDocumentWebviews(webviewPanel: vscode.WebviewPanel, myMapping: myMap): string | undefined {
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

    // The following is a map to track the primary WebviewPanel per document for speedy access referencing.
    // Map < document.uri.toString(), WebviewPanel >  
    public primaryWebviewForDocument: Map<string | undefined, [string | undefined, vscode.WebviewPanel | undefined] | undefined> = new Map();

    // The following variable keeps a record of which was the lastly focused TextEditor.document
    public currentActiveDocument: vscode.TextDocument | undefined = undefined;

    // We need the following counter to create a unique ID (viewType) for each webview.
    private static webviewCounter: number = 1;

    public activeWebviewForDocument: Map<string | undefined, [string| undefined, vscode.WebviewPanel | undefined] | undefined> = new Map();
    
    public createOrShowWebview(viewType: string, title: string, presentActiveDocumentUriString: string | undefined): ReturnValue {
        // Useful in development
        // this.documentWebviews.forEach((mySet, doc) => { for (const item in mySet) { console.log(doc, item);}} );

        // Out modus operandi is as follows.
        // Check whether panel already exists. If it does we show it, not create it.  
        
        // If the parameter presentActiveDocumentUriString has been passed the argument "as it says on the tin" then we will 
        // look up the corresponding WebviewPanel within primaryWebviewForDocument and return it within an object { Panel: WebviewPanel, 
        // newlyCreated: boolean }, by which this returning till this object shall also indicating to 
        // registerCommand('createOrShowWebview) that we are doing a webview SHOW, not a CREATE

        const existingPanel = this.primaryWebviewForDocument.get(presentActiveDocumentUriString);

        if (existingPanel && existingPanel[1]) { // WE ARE NOW HERE WITHIN WEBVIEW PANEL SHOW!!!!!!!!!!
            existingPanel[1].reveal();
            // The value of presentActiveDocumentUriString predicates upon the fact that when the webview was created
            // the value of this variable presentActiveDocument was set to vscode.window.activeTextEditor?.document
            return { uniqueViewTypeId: "dummy", panel: existingPanel[1], newlyCreated: false } ;  // Within Webview Panel SHOW
        }
        // WE ARE NOW NOT ANY LONGER WITHIN WEBVIEW PANEL SHOW!!!!!!
        // THEREFORE WE ARE NOW WITHIN WEBVIEW PANEL CREATE!!!!!
        // We now need to create a unique viewTypeId for the creation to the webview panel, which now ensues 

        // Reminder: we are NOW within WEBVIEW PANEL CREATE!!!!
        const formattedNumber = WebviewManager.webviewCounter.toString().padStart(4, '0');
        console.log(formattedNumber);
        const uniqueViewTypeId = `${viewType}${formattedNumber}`; 

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
                // We have the webview. Need to find the key and the viewTypeId
                const foundKeyFromThePanel = this.findKeyByWebviewPanelFromDocumentWebviews(panel, this.documentWebviews);
                const foundViewTypeIdFromPanel = this.findIdByWebviewPanelFromDocumentWebviews(panel, this.documentWebviews);
                if (foundKeyFromThePanel && foundViewTypeIdFromPanel){
                    // clear documentWebViews
                    this.deleteValueFromSetOfDocumentWebviews(foundKeyFromThePanel, [foundViewTypeIdFromPanel, panel], this.documentWebviews);
                    // clear primaryWebviewForDocument
                    if (this.primaryWebviewForDocument.has(foundKeyFromThePanel)){
                        const value = this.primaryWebviewForDocument.get(foundKeyFromThePanel);
                        // Check whether the value exists and clear it
                            if (value) {
                                // Clear the array contents
                                value[1] = undefined; // Set the WebviewPanel to undefined

                                // Optionally, you can also clear the string if needed
                                value[0] = undefined; // Set the string to undefined

                                // Set the entry to undefined      
                                this.primaryWebviewForDocument.set(foundKeyFromThePanel, undefined);
                            }                  
                        }
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
            this.addValueToSetOfDocumentWebviews(this.currentActiveDocument.uri.toString(), [uniqueViewTypeId, panel], this.documentWebviews);

            // primaryWebviewForDocument keeps a paired relationship record of which is the primary webview panel for 
            // each TextDocument.  We need this importantly in order to select the primary webview panel from the 
            // TextDocument.  IMPORTANT USER EXPERIENCE!!!! Ought this occur whenever the user is not within the 
            // primary webview panel --- i.e. might be within a secondary webview panel, or the TextEditor panel?
            // Answer is no. Rather than jumping Webview panels the UX would be much smoother if nothing happens upon 
            // a createOrShowWebpanel command after we already have a primary Webview panel.  There should not be any 
            // jumping around willy-nilly:  the user experience should be a stable one, not cryptic.  To change the
            //  webview panel the user shall use the mouse or a builtin command perhaps attached to a keybinding. 
            this.primaryWebviewForDocument.set(this.currentActiveDocument.uri.toString(), [uniqueViewTypeId, panel]);

            // the activeWebviewForDocument will be set outside of this function, i.e. when we are within 
            // registerCommand('createOrShowWebview') within activate.  This will be necessary in order to select the 
            // primaryWebviewForDocument being active so that the commands bound to the keybindings can be sent to it  

        }  
        // We were either 
        // 1. Within a webview, hence activeTextEditor === undefined, or 
        // 2. Not within a TextEditor, and so within a webviewPanel; 
        //    Both scenarios/cases are the same, so therefore the code should never arrive here because we will have 
        //    SHOWN prior and returned at that point in the code.
        
        return { uniqueViewTypeId: uniqueViewTypeId, panel: panel, newlyCreated: true };
    }

    public splitWebview(viewType: string, title: string): { panelFrom: vscode.WebviewPanel | undefined; panelTo: vscode.WebviewPanel } {

        // panelNew to be cleaned up within public dispose() and also upon panel.onDidDispose. 

        // We now need to draw our attention to the value of transientActiveDocumentUriString in order to recall the last
        // document which was selected.

        // This variable as transientActiveDocumentUriString was set during our eventListenerDisposable001  within the 
        // activate function 
        
        // We need the panel which was stored in the activeWebviewForDocument Mapping for this TextDocumentUriString in order 
        // to use it later from which to populate the newly created webviewPanel.  The accessor function for 
        // activeWebViewForDocument we shall use is  
        let panelFrom: vscode.WebviewPanel | undefined = undefined;
        //  Note that panelFrom is an automatic variable and thus will be disposed automatically when the function 
        // splitWebview terminates.
        
        const anArray = this.activeWebviewForDocument.get(this.transientActiveDocumentUriString);
        if (anArray){
            panelFrom = anArray[1];
        }

        // Make sure that the viewType ID is unique by using the same counter as within createOrShowWebview
        const formattedNumber = WebviewManager.webviewCounter.toString().padStart(4, '0');
        console.log(formattedNumber);
        const uniqueViewTypeId = `${viewType}${formattedNumber}`; 

        let panelNew: vscode.WebviewPanel;
        panelNew = vscode.window.createWebviewPanel(
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
        
        panelNew.onDidDispose(() => {
            // We have the webview. Need to find the key and the viewTypeId
            const foundKeyFromThePanel = this.findKeyByWebviewPanelFromDocumentWebviews(panelNew, this.documentWebviews);
            const foundViewTypeIdFromPanel = this.findIdByWebviewPanelFromDocumentWebviews(panelNew, this.documentWebviews);
            if (foundKeyFromThePanel && foundViewTypeIdFromPanel){
                // clear documentWebViews
                this.deleteValueFromSetOfDocumentWebviews(foundKeyFromThePanel, [foundViewTypeIdFromPanel, panelNew], this.documentWebviews);
                // clear activeWebviews
                if (this.activeWebviewForDocument.has(foundKeyFromThePanel)){
                    // Clear activeWebviewForDocument
                    const value = this.activeWebviewForDocument.get(foundKeyFromThePanel);
                    // Check whether the value exists and clear it
                    if (value) {
                        // Clear the array contents
                        value[1] = undefined; // Set the WebviewPanel to undefined
    
                        // Optionally, you can also clear the string if needed
                        value[0] = undefined; // Set the string to undefined
    
                        // Set the entry to undefined      
                        this.activeWebviewForDocument.set(foundKeyFromThePanel, undefined);
                    }                  
                }
            }   
        });

        // Now that a reference to this panelFrom has been recorded we can set the activeWebviewForDocument to record the new 
        // activeWebviewPanel that has been created
        this.activeWebviewForDocument.set(this.transientActiveDocumentUriString, [uniqueViewTypeId , panelNew]);

        // We must also add this new webviewpanel to the Set of documentWebviews mapping for this transientActiveDocumentUriString
        this.addValueToSetOfDocumentWebviews(this.transientActiveDocumentUriString, [uniqueViewTypeId, panelNew], this.documentWebviews);
        
        // We return in order to set up the webview content skeleton from a public function of this instance of webviewPanel.
        // This requires us to refer to an instance of the Subtitles class which is only available within the scope of the 
        // activate function.

        return { panelFrom: panelFrom, panelTo: panelNew};

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

        // Dispose all data structures from primaryWebviewForDocument
        for (const [key, myArray] of this.primaryWebviewForDocument){
            // Check whether the value exists and clear it
                if (myArray) {
                    // Clear the array contents
                    myArray[1] = undefined; // Set the WebviewPanel to undefined

                    // Optionally, you can also clear the string if needed
                    myArray[0] = undefined; // Set the string to undefined

                    // Set the entry to undefined      
                this.primaryWebviewForDocument.set(key, undefined);
            }  
        }
        
        // Dispose all data structures from activeWebviewForDocument
        for (const [key, myArray] of this.activeWebviewForDocument){
            // Check whether the value exists and clear it
                if (myArray) {
                    // Clear the array contents
                    myArray[1] = undefined; // Set the WebviewPanel to undefined

                    // Optionally, you can also clear the string if needed
                    myArray[0] = undefined; // Set the string to undefined

                    // Set the entry to undefined      
                this.primaryWebviewForDocument.set(key, undefined);
            }  
        }

        // Clear all maps
        this.documentWebviews.clear();
        this.primaryWebviewForDocument.clear();
    }
}
