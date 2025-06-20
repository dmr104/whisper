import * as vscode from 'vscode';

export type ReturnValue = { uniqueViewTypeId: string, panel: vscode.WebviewPanel, newlyCreated: boolean }

type myMap = Map<string | undefined, Set<[string, vscode.WebviewPanel]>>

export class WebviewManager implements vscode.Disposable {
    
    // The following variable is set within onDidChangeActiveEditor within eventListenerDisposable001 within activate function.
    // The purpose of this variable is to give us the ability to select which active webviewPanel is currently in focus, because
    // such functionality is missing from the vscode API.  We do this by finding whether the following variable is undefined.
    // If it is undefined then we get the value of key as undefined from within the activeWebviewForDocument mapping, and this 
    // value gives us our active webview Panel.  If it IS defined then we know that we are within the focus of NOT a webview, i.e.
    // most probably an active TextEditor tab
    public transientActiveDocumentUriString: string | undefined = undefined;

    // The following variable keeps a record of the fact that a webviewPanel with this particular viewType (a unique ID) has 
    // been created, and is associated with potentially more other webviewPanels in an association with the TextDocument.

    // documentWebviews is Map < document.uri, Set of webviews > where the set consists of (item1, item2, ...) where
    // itemX is [idX, webViewPanelX] where X is a number such like 0001
    public documentWebviews: myMap = new Map();

    // We need to write a helper function which will search for a particular viewType ID within the documentWebviews 
    // structure when we know its webviewPanel
    private findIdByWebviewPanelFromDocumentWebviews(panel: vscode.WebviewPanel, documentWebviews: myMap ): string | undefined {
          for (const [key, webviewSet] of documentWebviews) {
            
            for (const [id, webviewPanel] of webviewSet) {
                if (webviewPanel === panel){
                    return id;
                }
            }
        }
        return undefined; 
    }

    // We need to write a helper function which will add a value to a particular Set within documentWebviews
    private addValueToSetOfDocumentWebviews(key: string | undefined, value: [string, vscode.WebviewPanel], myMapping: myMap){
        // Check whether the Map already has the key
        if (!myMapping.has(key)) {
            // If not, create a new Set for this key
            myMapping.set(key, new Set<[string, vscode.WebviewPanel]>());
        }
        
        // Retrieve the Set and add the new value
        const webviewSet = myMapping.get(key);
        webviewSet?.add(value); // Use optional chaining to add the value        
    }

    // We need to write a helper function which will delete a value from a particular Set within documentWebviews by its key.
    // Two arrays with the same content are considered different if they are not the same object in memory. So we must not simply 
    // delete this object by refering to its value as an Array within the Set within the Mapping of the argument for myMapping. 
    // The first entry of the array is unique so we can select by value, and find out its key, which is not unique. We compare 
    // the value of the item within this Array with the value stored within the corresponding argument to the parameter as myMapping
    private deleteValueFromSetOfDocumentWebviews(key: string, value: [string, vscode.WebviewPanel], myMapping: myMap){
        // Check if the Map has the key
        if (myMapping.has(key)) {
            const webviewSet = myMapping.get(key);
            
            // Use the delete method to remove the value
            if (webviewSet) {
            // Find the value to delete by checking the first element of each array
            for (const item of webviewSet) {
                if (item[0] === value[0]) {
                    // Delete the matching item
                    webviewSet.delete(item);
                    break; // Exit loop after deleting
                }
            }
            
                // Remove the Set from the Map if it's empty
                if (webviewSet.size === 0) {
                    myMapping.delete(key);
                }
            }
        }
    }

    // We need to write a helper function which will return the associated key from a particular Set within documentWebviews
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

    // We need to write a helper function which will return the associated key from a particular Set within documentWebviews
    public findKeyByIdFromDocumentWebviews(viewTypeId: string, myMapping: myMap): string | undefined {
        for (const [key, webviewSet] of myMapping) {
            for (const [id, panel] of webviewSet) {
                if (id === viewTypeId) {
                    return key; // Return the key if the WebviewPanel matches
                }
            }
        }
        return undefined; // Return undefined if not found        
    }    

    // The following is a map to track the primary WebviewPanel per document for speedy access referencing.
    // Map < document.uri.toString(), WebviewPanel >  
    public primaryWebviewForDocument: Map<string | undefined, [string | undefined, vscode.WebviewPanel | undefined] | undefined> = new Map();

    // The following variable keeps a record of which was the lastly focused TextEditor.document
    public currentActiveDocumentUriString: string | undefined = undefined;
 
    // The following variable is a mapping between the webviewManager.currentActiveDocumentUriString and the object which contains the 
    // actualJsonRecord stored in memory for this open TextEditor. We will have to set its value and its mapping whenever 
    // we createOrShowWebview.  We do this in commandDisposable001, and retrieve its value in commandDisposable004.    
    public uriToJsonMapping: Map<string | undefined, any> = new Map();

    // We need the following counter to create a unique ID (viewType) for each webview.
    private static webviewCounter: number = 1;

    // The following keeps a direct association between the documentUriString and its ACTIVE webviewPanel. It is as a 1:1 mapping, 
    // not a 1:many.  When the key is undefined we attain the precise webviewPanel which is active as its value.  This is good for 
    // us.  It allows us to select the active webview.  There was no other way to achieve this with the current API, I am afraid
    public activeWebviewForDocument: Map<string | undefined, [string, vscode.WebviewPanel] | undefined> = new Map().set(undefined, undefined);
    
    public createOrShowWebview(viewType: string, title: string, presentActiveDocumentUriString: string | undefined): ReturnValue {

        // Our modus operandi is as follows.
        // Check whether panel already exists. If it does we show it, not create it.  
        
        // If the parameter presentActiveDocumentUriString has been passed the argument "as it says on the tin" then we will 
        // look up the corresponding WebviewPanel within primaryWebviewForDocument and return it within an object 
        // { uniqueViewTypeId: 'dummy', panel: WebviewPanel, newlyCreated: boolean }, by which this returning till this object 
        // shall also be indicating to registerCommand('createOrShowWebview) that we are doing a webview SHOW, not a CREATE, 
        // because a primary webview already exists for this documentUriString

        const existingPanel = this.primaryWebviewForDocument.get(presentActiveDocumentUriString);
        // The value of presentActiveDocumentUriString predicates upon the fact that when the webview was created
        // the value of the variable as presentActiveDocument was set to vscode.window.activeTextEditor?.document

        if (existingPanel && existingPanel[1]) { // WE ARE NOW HERE WITHIN WEBVIEW PANEL SHOW!!!!!!!!!!
            existingPanel[1].reveal();
            return { uniqueViewTypeId: 'dummy', panel: existingPanel[1], newlyCreated: false } ;  // Within Webview Panel SHOW
        }
        // WE ARE NOW NOT ANY LONGER WITHIN WEBVIEW PANEL SHOW!!!!!!
        // THEREFORE WE ARE NOW WITHIN WEBVIEW PANEL CREATE!!!!!
        // We now need to create a unique viewTypeId for the creation to the webview panel, which now ensues 

        // Reminder: we are NOW within WEBVIEW PANEL CREATE!!!!

        const formattedNumber = WebviewManager.webviewCounter.toString().padStart(4, '0');

        const uniqueViewTypeId = `${viewType}${formattedNumber}`; 

        // The panel doesn't already exist. Therefore we need to create it.  Remember that we are creating and returning 
        // a bare-bones webview along with the extra value 'newlyCreated:' (which is a boolean) upon which decisions will 
        // be made within the registering of our command within commandDisposable001
        let panel: vscode.WebviewPanel;
        panel = vscode.window.createWebviewPanel(
            uniqueViewTypeId,
            uniqueViewTypeId, // title,
            {preserveFocus: false, viewColumn: vscode.ViewColumn.One},
            {
                enableScripts: true,
                enableFindWidget: true,
                retainContextWhenHidden: true
            }
        );
        
        // increment the class counter for a unique viewType ID
        WebviewManager.webviewCounter++;

        // We will now use webViewPanel.onDidChangeViewState which fires view state of a webview panel changes. 
        // The "view state" refers to:
        // Visibility - Whether the webview is currently visible to the user (User hides/shows the webview panel)
        // Active state - Whether the webview is the currently active editor (User switches between tabs)
        // Active state - Whether the webview is the currently focused editor (Webview gets focused or loses focus)

        // We are particularly interested in onDidChangeViewState because this will allow us to use the key as the variable as 
        // transientActiveDocumentUriString within activeWebviewForDocument mapping.  By doing this we will always have the key as
        // the variable transientActiveDocumentUriString being of the value as undefined, associated with the value as an array
        // containing [uniqueViewTypeId, panel] within our mapping as activeWebviewForDocument 

        // Recall that transientActiveDocumentUriString is set by an eventListener within the activate function 
        // within eventListenerDisposable001 to undefined every time a non-TextEditor is clicked to become within focus.  This 
        // will be perfect for our needs as it allows us to keep a record of which webview editor is currently selected.  There 
        // was no other way to do this, I am afraid, with the current vscode API

        const viewStateDisposable = panel.onDidChangeViewState((e: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
            const webviewPanel = e.webviewPanel;
            if (webviewPanel.active){
                this.activeWebviewForDocument.set(this.transientActiveDocumentUriString, [uniqueViewTypeId, panel]);
            } else {

                // We need also to set the currentActiveDocumentUriString (the purpose of which is to be extrapolated by the value of 
                // transientActiveDocumentUriString) in order to keep the variable as currentActiveDocumentUriString up to date with 
                // whether our primary webpanel has been re-selected into focus.  Note we need to do this also for the webpanel 
                // which is created by the function as splitWebview
    
                // By the logic of not being within webviewPanel.active, we are within the focus of a TextEditor, so we should
                // keep a record of this TextEditor's documentUri toString (which is recorded within 
                // transientActiveDocumentUriString) within the variable as currentActiveDocumentUriString.  As a 
                // defensive procedure we check whether there is already an active text editor for this 
                // document prior. If transientActiveDocumentUriString was undefined (i.e. a webview is selected to become 
                // within focus) then the currentActiveDocumentUriString won't change from what it was.

                if (this.transientActiveDocumentUriString){
                    this.currentActiveDocumentUriString = this.transientActiveDocumentUriString;            
                }
    
                // This conditional processing is good because if currentActiveDocumentUriString is undefined, presumably because
                // If transientActiveDocumentUriString was undefined (i.e. a webview is selected to become within 
                // focus) then the currentActiveDocumentUriString won't change from what it was.
    
                // The idea of setting currentActiveDocumentUriString outside of the scope of webview.active, within an else clause
                // (i.e. when webview.active === false) is to capture the event which corresponds to the transition between a 
                // webview to a TextEditor, and not that from a webview to a webview (webview.active === true), nor that from a 
                // TextEditor to a webview (webview.active === true).  It works, so no complaining            
            }
        });

        // Handle disposal
        panel.onDidDispose(() => {
                // Clean up 
                viewStateDisposable.dispose();

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
                                this.primaryWebviewForDocument.delete(foundKeyFromThePanel);
                            }                  
                        }
                    }    
                }
            );
        
        // Set the currently active document. Our goal is the following. Only if TextDocument is focused 
        // and a webview for it does not currently exist should currentActiveDocumentUriString be set. Else the primary 
        // webview for it should be shown.

        // The API for window.activeTextEditor says "The active editor is the one that currently has focus or, 
        // when none has focus, the one that has changed input most recently.". This is useful to our programming 
        // paradigm because we have the following scenarios:
        // 1. the focused TextEditor does not have a webview. In this case the currentActiveDocumentUriString is set 
        //    to the activeTextEditor
        // 2. the focused TextEditor DOES have a webview.  In this case we have already SHOWN the webview and 
        //    thus never reach this point in the function createOrShowWebview
        // 3. the TextEditor is not focused.  In this case it must be (or it is most probably) that we are 
        //    focused within a webview.  Here the viewType ID of the webviewPanel will have been found 
        //    already, so we will have SHOWN this webviewPanel.webview already, and thus never reach this point in 
        //    the code of the createOrShowWebview function 

        // Here is where the magic happens.  The onDidChangeActiveTextEditor does indicate which current document is open.
        // The Api for 
        // window.onDidChangeActiveTextEditor: Event<TextEditor | undefined>  
        // states
        // "An Event which fires when the active editor has changed. Note that the event also fires when the active 
        // editor changes to undefined.""

                            // REMINDER: We are still within the WEBPANEL CREATE!! 

        if (this.currentActiveDocumentUriString){  // We were within an active editor at this point

            // Track the panel.  If we are not within a TextEditor then presumably we are within a webview and 
            // hence the panel is already tracked, and won't become re-tracked again because we will never reach 
            // here having returned at a SHOW instead 
            this.addValueToSetOfDocumentWebviews(this.currentActiveDocumentUriString, [uniqueViewTypeId, panel], this.documentWebviews);

            this.activeWebviewForDocument.set(this.currentActiveDocumentUriString, [uniqueViewTypeId, panel]);
            // We need to set the activeWebviewForDocument for it to be accessed outside of this function, namely when 
            // we are within splitWebview from activate within commandDisposable002, when we 
            // shall invoke
            // const value = this.activeWebviewForDocument.get(this.transientActiveDocumentUriString); 
            // where hopefully transientActiveDocumentUriString will be the same string that the currentActiveDocumentUriString
            // was in the setting to it here.  This will lead to a good user experience, as if the TextEditor is has not been clicked 
            // upon but is currently open at the point the extension starts or restarts, then the currentActiveDocumentUriString
            // will become the key stored in the mapping as activeWebviewForDocument, which key will hopefully have the same 
            // meaning as transientActiveDocumentUriString when transientActiveDocumentUriString is used later as the key 
            // in an activeWebviewForDocument.get(this.transientActiveDocumentUriString).  I hope this makes sense to the 
            // reader. 
        }

        // If we were either 
        // 1. Within a webview, hence activeTextEditor === undefined, or 
        // 2. Not within a TextEditor, and so within a webviewPanel, hence activeTextEditor === undefined; 
        // then both scenarios/cases are the same, so we proceed within this function

        // Note that the following part about storing the key as undefined with the presently created panel is
        // especially important as it allows us to access the newly created panel before the user has clicked onto the
        // TextEditor associated with this panel.  Clicking on the TextEditor will bring it into focus and the variable as
        // transientActiveDocumentUriString will always be set by the onDidChangeActiveTextEditor as a callback 
        // within the activate function from eventListenerDisposable001.  But what if this hasn't happened yet?  
        // What if we are presently within the webview and have never clicked upon the corresponding TextEditor?  
        // We need a way to grab the unique viewTypeId of this active text editor in order to look it up its key within 
        // documentWebviews, and this will give us our correspondingly associated TextDocumentUriString if we are within 
        // the webview, not the TextEditor.  I wish the vscode API was more sophisticated, but it isn't, so this is what 
        // we will have to do  
        
        // Within the splitWebview function transientActiveDocumentUriString is either defined or undefined.  This is good 
        // because within activeWebviewForDocument we can have a key corresponding to it being defined and a key corresponding 
        // to it being undefined, both of which we set manually as the active webview, within this function as 
        // createOrShowWebview. Within the function as splitWebview we use the following logic.  If 
        // transientActiveDocumentUriString is defined (i.e. not undefined) we are NOT within a webview so we must return 
        // at this point.  Else transientActiveDocumentUriString is undefined, so we are within a webview, so we must firstly 
        // find the currently active webview which will hopefully always correspond to the key as undefined within 
        // activeWebviewForDocument; then we must take this active webview and look up its corresponding document key within 
        // documentWebviews. This key will allow us to decide which bunch of grapes this active webview belongs to.  We need 
        // this information in order to split the Webview, else how do we know which bunch of grapes to put the newly created 
        // webview panel into?  If we had open, for example bunch1 associated with doc1, and bunch2 associated with doc2, and 
        // we click onto doc1, then a webview within bunch2, and split it; without this functionality of lookups the webview 
        // from bunch2 would gain a split from bunch1.  This would not be what we desire.  I hope this makes sense
        this.activeWebviewForDocument.set(undefined, [uniqueViewTypeId, panel]);
        
        return { uniqueViewTypeId: uniqueViewTypeId, panel: panel, newlyCreated: true };
    }

    public splitWebview(viewType: string, title: string, context: vscode.ExtensionContext): 
    { From: {WvIdFrom: string, panelFrom: vscode.WebviewPanel | undefined}; To: {WvIdTo: string, panelTo: vscode.WebviewPanel | undefined}} {
        
        // We need the panel which was stored in the activeWebviewForDocument Mapping for this 
        // TextDocumentUriString in order to use it later, from which to populate the newly created webviewPanel.  

        // We hardcode the key as undefined here, because we cannot assume that transientActiveDocumentUriString has 
        // the meaning as undefined at this point in the code. 

        let anArray;
        if (this.activeWebviewForDocument.has(undefined)){
            anArray = this.activeWebviewForDocument.get(undefined); 
        }

        // As a precautionary measure
        if (!anArray){
            vscode.window.showInformationMessage('Cannot split webview as you need to open a JSON output document from openai whisper and then a webview first');
            return { From: {WvIdFrom: "", panelFrom: undefined}, To: {WvIdTo: "", panelTo: undefined }};
        }
        
        // If we reach here then we can conclude that anArray is not undefined
        let webviewIdFrom = anArray[0];
        let panelFrom = anArray[1];        
 
        // To indicate to the calling function that we wish the calling function to return, we return the following to it.
        if (this.transientActiveDocumentUriString) {  // We are not within a Webview
            vscode.window.showInformationMessage('Cannot split webview unless you have one open and in focus'); 
            return { From: {WvIdFrom: "", panelFrom: undefined}, To: {WvIdTo: "", panelTo: undefined }};
        } 
        // The present return will only be invoked if the focus is within an active TextEditor.  Recall that 
        // transientActiveDocumentUriString is set within an eventListener from the activate function, and will be undefined
        // only if we are within a webview, and hence will be defined if we are not (i.e. within a TextEditor)    
        
        // The following hack is used to control what happens when we close all the webviews and the TextEditor.
        // Without it we get unstable functionality within the User experience, with webviews opening when no
        // TextEditor is open
        // Obtain the ACTIVE webviewPanel
        let myCurrentActiveWebviewForDocumentValue;
        let myCurrentActiveWebviewForDocumentUri;

        if (this.activeWebviewForDocument.has(this.transientActiveDocumentUriString)){
            myCurrentActiveWebviewForDocumentValue = this.activeWebviewForDocument.get(this.transientActiveDocumentUriString);
        }

        if (this.activeWebviewForDocument.has(this.transientActiveDocumentUriString) &&
        myCurrentActiveWebviewForDocumentValue ){ // we are not within a webviewPanel
            myCurrentActiveWebviewForDocumentUri = myCurrentActiveWebviewForDocumentValue[0];
        } // the variable as myCurrentActiveWebviewForDocumentValue is undefined before any webpanel is opened.  Thereafter it 
        // keeps a record of the first webviewpanel opened, even if we go back to focus the Texteditor panel

        // Now we will find the key corresponding with the myCurrentActiveWebviewForDocumentUri within the mapping as 
        // webviewManager.documentWebviews with the id for the item within the set as myCurrentActiveWebviewForDocumentUri
        let myCurrentKeyFromMyCurrentActiveWebviewForDocumentUri: string | undefined = undefined;
        if (myCurrentActiveWebviewForDocumentUri){
            myCurrentKeyFromMyCurrentActiveWebviewForDocumentUri = this.findKeyByIdFromDocumentWebviews(
                myCurrentActiveWebviewForDocumentUri, this.documentWebviews);
        }

        let myValue;
        if (this.primaryWebviewForDocument.has(myCurrentActiveWebviewForDocumentUri)){
            myValue = this.primaryWebviewForDocument.get(myCurrentActiveWebviewForDocumentUri);
        }

        if (myValue && myValue[0] !== myCurrentActiveWebviewForDocumentUri){
            vscode.window.showInformationMessage('Please open a JSON document from whisper and open a webview first'); 
            return { From: {WvIdFrom: "", panelFrom: undefined}, To: {WvIdTo: "", panelTo: undefined }};
        }

        // If we reach here in the code we can infer that a webview is currently within focus, hence 
        // transientActiveDocumentUriString is undefined ---- IMPORTANT point to think about.
        // If transientActiveDocumentUriString should have been defined then we will never have reached here

        // Make sure that the viewType ID is unique by using the same counter as within createOrShowWebview
        const formattedNumber = WebviewManager.webviewCounter.toString().padStart(4, '0');
       
        const uniqueViewTypeId = `${viewType}${formattedNumber}`;         

        // panelNew to be cleaned up within public dispose() and also upon panel.onDidDispose. 
        let panelNew: vscode.WebviewPanel = vscode.window.createWebviewPanel(
            uniqueViewTypeId,
            uniqueViewTypeId, // title,
            {preserveFocus: false, viewColumn: vscode.ViewColumn.One},
            {
                enableScripts: true,
                enableFindWidget: true,
                retainContextWhenHidden: true
            }
        );

        // increment the class counter for a unique viewType ID
        WebviewManager.webviewCounter++;        
        

        // We now need to draw our attention to the value of currentActiveDocumentUriString in order to recall the last document 
        // which was selected

        // This variable as transientActiveDocumentUriString was set during our eventListenerDisposable001 within the 
        // activate function 
         
        // So we should, by associating a bunch of a webviews with a SPECIFIC document, collate these and send information from 
        // one webview to all others in the Set when we need to broadcast individual segments from the DOM from one specific 
        // broadcaster to the others in another function, which will require that this information will have been stored 

        // The idea behind the following logic is that if no TextEditor has been opened, presentActiveDocumentUriString 
        // will be undefined, but if one is open and one is in focus when the extension starts, then hopefully 
        // currentActiveDocumentUriString will have already been set by the createOrShowWebview function 
        if (this.currentActiveDocumentUriString){
            this.addValueToSetOfDocumentWebviews(this.currentActiveDocumentUriString, [uniqueViewTypeId, panelNew], this.documentWebviews);
        } else {
            vscode.window.showInformationMessage('You need to open a JSON output file from openAI whisper speech to text recognition');
        }       

        // We must set the activeWebviewForDocument to record the new activeWebviewPanel that has been created.  This is done 
        // so that this active webview will have an association to be used later.  Recall that transientActiveDocumentUriString 
        // is set within the onDidChangeActiveTextEditor callback within eventListenerDisposable001 within the activate function, 
        // and so will specifically mirror whether or not we are within a TextEditor. The API of onDidChangeACtiveTextEditor says 
        // "An Event which fires when the active editor has changed. Note that the event also fires when the active editor changes 
        // to undefined". From my own investigations I note that when the TextEditor is deselected (i.e. a webview IS selected) 
        // then the event.document.uri.toString() will also be undefined, where event is a TextEditor.  (According to the API 
        // "onDidChangeActiveTextEditor: Event<TextEditor | undefined>"). This event will not fire when one webview is focused from 
        // another webview irregardless of which webviews these are.  It will only fire when a TextEditor becomes focused from 
        // a webview, or a webview becomes focused from a TextEditor, or one TextEditor becomes focused from a different TextEditor.
        
        // To record the last record of this behaviour in a variable as activeWebviewForDocument is especially useful as it allows us 
        // to fathom which TextEditor was last selected.  This may seem it is a duplication of information which is recorded within 
        // the variable currentActiveDocumentUriString, but it is not.  It is not because currentActiveDocumentUriString will retain state after 
        // the focus of the document whose information it records is lost, while transientActiveDocumentUriString will lose its 
        // state at this point.  Therefore transientActiveDocumentUriString gives us the flexibility to store only the following 
        // only when a transition of focus occurs from a webview to a TextEditor or from one TextEditor to another one within the 
        // variable as the mapping as activeWebviewForDocument. Recall that we are currently within the function splitWebview.  
        // We DO want to record the webview with the key as undefined into the variable mapping as activeWebviewForDocument
        // if and when the variable as transientActiveDocumentUriString has the meaning as undefined

        this.activeWebviewForDocument.set(this.transientActiveDocumentUriString, [uniqueViewTypeId , panelNew]);
        
        // We can set a disposable onDidChangeViewState upon the webviewPanel panelNew
        const viewStateDisposable = panelNew.onDidChangeViewState((e: vscode.WebviewPanelOnDidChangeViewStateEvent) => { 
            const webviewPanel = e.webviewPanel;
            if (webviewPanel.active){
                this.activeWebviewForDocument.set(this.transientActiveDocumentUriString, [uniqueViewTypeId, panelNew]);
            } else {

                // We need also to set the currentActiveDocumentUriString (the object of which is to be extrapolated by the value of 
                // transientActiveDocumentUriString) in order to keep the variable as currentActiveDocumentUriString up to date with 
                // whether our primary webpanel has been re-selected into focus.  Note we need to do this also for the webpanel 
                // which is created by the function as splitWebview

                // By the logic of not being within webviewPanel.active, we are within the focus of a TextEditor, so we should
                // keep a record of this TextEditor's documentUri toString (which is recorded within 
                // transientActiveDocumentUriString) within the variable as currentActiveDocumentUriString.  As a 
                // defensive procedure we check whether there is already an active text editor for this 
                // document prior. If transientActiveDocumentUriString was undefined (i.e. a webview is selected to become 
                // within focus) then the currentActiveDocumentUriString won't change from what it was.
                if (this.transientActiveDocumentUriString){
                    this.currentActiveDocumentUriString = this.transientActiveDocumentUriString;            
                }                 
    
                // The idea of setting currentActiveDocumentUriString outside of the scope of webview.active, with an else clause
                // (i.e. when webview.active === false), is to capture the event which corresponds to the transition between a 
                // webview to a TextEditor, and not that from a webview to a webview (webview.active === true), nor that from a 
                // TextEditor to a webview (webview.active === true)
            }
        },
        undefined,
        context.subscriptions
    );        
        

        panelNew.onDidDispose(() => {
            // Don't forget to dispose the eventListener disposable!!!
            // viewStateDisposable.dispose();

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
    
                        // Set the entry to undefined      
                        this.activeWebviewForDocument.delete(foundKeyFromThePanel);
                    }                  
                }
            }   
        });

        // If we reach here then transientActiveDocumentUriString was already undefined.  Instead of using this variable I 
        // hard-code the key as undefined while setting the following mapping.  Recall our objective here is to record which 
        // active webview is associated with our most recently created webview within this function as splitWebview

        // this.activeWebviewForDocument.set(undefined, [uniqueViewTypeId , panelNew]);

        // We return in order to set up the webview content skeleton within activate. We must refer to an instance of the Subtitles
        // class within activate, and this is only available within the scope of the activate function.

        return { From: {WvIdFrom: webviewIdFrom, panelFrom: panelFrom}, To: {WvIdTo: uniqueViewTypeId, panelTo: panelNew}};

    }

    public broadcastToOtherWebviews(id: string, segmentHTML: string, webviewPanel: vscode.WebviewPanel){

        const foundKey = this.findKeyByWebviewPanelFromDocumentWebviews(webviewPanel, this.documentWebviews);
        const foundViewTypeId = this.findIdByWebviewPanelFromDocumentWebviews(webviewPanel, this.documentWebviews);

        let grapes;
        if (this.documentWebviews.has(foundKey)){
            grapes = this.documentWebviews.get(foundKey);
        }

        if (grapes){
            for (const panel of grapes) {
                if (panel[0] !== foundViewTypeId){
                    // Here we are sending the broadcast to be received by all webviews except the sender
                    panel[1].webview.postMessage({ receivedBroadcast: 'broadcastReceivedByWebviews', segmentId: id, segmentHTML: segmentHTML });
                }
            }
        } else {
            console.log('No panels found for the given key.');
        }
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

                    // Set the entry to undefined      
                this.primaryWebviewForDocument.set(key, undefined);
            }  
        }
        
        // Clear all maps
        this.documentWebviews.clear();
        this.primaryWebviewForDocument.clear();
    }
}
