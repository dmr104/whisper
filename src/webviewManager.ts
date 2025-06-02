import * as vscode from 'vscode';

export type ReturnValue = { uniqueViewTypeId: string, panel: vscode.WebviewPanel, newlyCreated: boolean }

type myMap = Map<string | undefined, Set<[string, vscode.WebviewPanel]>>

export class WebviewManager implements vscode.Disposable {
    
    // The following variable is set within onDidChangeActiveEditor within eventListenerDisposable001 within activate function
    public transientActiveDocumentUriString: string | undefined = undefined;

    // The following variable keeps a record of the fact that a webviewPanel with this particular viewType (a unique ID) has 
    // been created, and is associated with potentially more other webviewPanels in an association with the TextDocument.

    // documentWebviews is Map < document.uri, Set of webviews >
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

    // We need to write a helper function which will delete a value from a particular Set within documentWebviews.
    // Two arrays with the same content are considered different if they are not the same object in memory.
    // The first entry of the array is unique so we can select by value. We compare its value with the value stored
    // within the argument corresponding to the parameter as myMapping
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
    public currentActiveDocumentUriString: string | undefined = undefined; 

    // We need the following counter to create a unique ID (viewType) for each webview.
    private static webviewCounter: number = 1;

    public activeWebviewForDocument: Map<string | undefined, [string| undefined, vscode.WebviewPanel | undefined] | undefined> = new Map().set(undefined, undefined);
    
    public createOrShowWebview(viewType: string, title: string, presentActiveDocumentUriString: string | undefined): ReturnValue {

        // Our modus operandi is as follows.
        // Check whether panel already exists. If it does we show it, not create it.  
        
        // If the parameter presentActiveDocumentUriString has been passed the argument "as it says on the tin" then we will 
        // look up the corresponding WebviewPanel within primaryWebviewForDocument and return it within an object 
        // { uniqueViewTypeId: 'dummy', panel: WebviewPanel, newlyCreated: boolean }, by which this returning till this object 
        // shall also indicating to registerCommand('createOrShowWebview) that we are doing a webview SHOW, not a CREATE, 
        // because a primary webview already exists for this documentUriString

        const existingPanel = this.primaryWebviewForDocument.get(presentActiveDocumentUriString);

        if (existingPanel && existingPanel[1]) { // WE ARE NOW HERE WITHIN WEBVIEW PANEL SHOW!!!!!!!!!!
            existingPanel[1].reveal();
            // The value of presentActiveDocumentUriString predicates upon the fact that when the webview was created
            // the value of this variable as presentActiveDocument was set to vscode.window.activeTextEditor?.document
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
            title,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
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

        // We are particularly interested in onDidChangeViewState because this will allow us to use the key the variable as 
        // transientActiveDocumentUriString within activeWebviewForDocument mapping.  By doing this we will always have the key as
        // the variable transientActiveDocumentUriString being of the value as undefined associated with the value as an array
        // containing [uniqueViewTypeId, panel]. Recall that transientActiveDocumentUriString is set by an eventListener 
        // within the activate function to undefined every time a non-TextEditor is clicked to become within focus.  This 
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
    
                // This optional processing is good because if AnEditor is undefined, presumably because
                // If transientActiveDocumentUriString was undefined (i.e. a webview is selected to become within 
                // focus) then the currentActiveDocumentUriString won't change from what it was.
    
                // This optional processing is good because if AnEditor is undefined, presumably because 
                // transientActiveDocumentUriString was undefined (i.e. a webview is selected to become within focus) then
                // the currentActiveDocumentUriString won't change from what it was.
    
                // The idea of setting currentActiveDocumentUriString outside of the scope of webview.active, with an else clause
                // (i.e. when webview.active === false) is to capture the event which corresponds to the transition between a 
                // webview to a TextEditor, and not that from a webview to a webview (webview.active === true), nor that from a 
                // TextEditor to a webview (webview.active === true)            
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

        // Here is where the magic happens.  The activeTextEditor does indicate which current document is open

                            // REMINDER: We are still within the WEBPANEL CREATE!! 

        if (this.currentActiveDocumentUriString){  // We were within an active editor at this point
            
            // The API for activeTextEditor says "The currently active editor or undefined. The active editor is 
            // the one that currently has focus or, when none has focus, the one that has changed input most recently."

            // Track the panel.  If we are not within a TextEditor then presumably we are within a webview and 
            // hence the panel is already tracked, and won't become re-tracked again because we will never reach 
            // here having returned at a SHOW instead 
            this.addValueToSetOfDocumentWebviews(this.currentActiveDocumentUriString, [uniqueViewTypeId, panel], this.documentWebviews);

            // primaryWebviewForDocument keeps a paired relationship record of which is the primary webview panel for 
            // each TextDocument.  We need this importantly in order to select the primary webview panel from the 
            // TextDocument.  IMPORTANT USER EXPERIENCE!!!! Ought this occur whenever the user is not within the 
            // primary webview panel --- i.e. might be within a secondary webview panel, or the TextEditor panel?
            // Answer is no. Rather than jumping Webview panels the UX would be much smoother if nothing happens upon 
            // a createOrShowWebpanel command after we already have a primary Webview panel.  There should not be any 
            // jumping around willy-nilly:  the user experience should be a stable one, not cryptic.  To change the
            //  webview panel the user shall use the mouse or a builtin command perhaps attached to a keybinding. 
            this.primaryWebviewForDocument.set(this.currentActiveDocumentUriString, [uniqueViewTypeId, panel]);
            // This is necessary in order to select the  primaryWebviewForDocument being active so that the commands 
            // bound to the keybindings can be sent to it

            this.activeWebviewForDocument.set(this.currentActiveDocumentUriString, [uniqueViewTypeId, panel]);
            // We need to set the activeWebviewForDocument for it to be accessed outside of this function, namely when 
            // we are within registerCommand('createOrShowWebview') within activate when we shall invoke
            // const value = this.activeWebviewForDocument.get(this.transientActiveDocumentUriString); 
            // where hopefully transientActiveDocumentUriString will be the same string that that currentActiveDocumentUriString
            // was in the setting.  This will lead to a good user experience as if the TextEditor is has not been clicked 
            // upon but is currently open at the point the extension starts or restarts then the currentActiveDocumentUriString
            // will be the key stored in the mapping as activeWebviewForDocument, which key will hopefully have the same 
            // meaning as transientActiveDocumentUriString when transientActiveDocumentUriString is used later as the key 
            // in an activeWebviewForDocument.get(this.transientActiveDocumentUriString).  I hope this makes sense to the 
            // reader. 
        }

        // If we were either 
        // 1. Within a webview, hence activeTextEditor === undefined, or 
        // 2. Not within a TextEditor, and so within a webviewPanel, hence activeTextEditor === undefined; 
        // then both scenarios/cases are the same, so we proceed within this function.

        // Note that the following part about storing the key as undefined with the presently created panel is
        // especially important as it allows us to access the newly created panel before the user has clicked onto the
        // TextEditor associated with this panel.  Clicking on the TextEditor will bring it into focus and the variable as
        // transientActiveDocumentUriString will always be set by the onDidChangeActiveTextEditor as a callback 
        // within the activate function.  But what if this hasn't happened yet?  What if we are presently within the 
        // webview and have never clicked upon the corresponding TextEditor?  We need a way to grab the unique viewTypeId 
        // of this active text editor in order to look it up its key within documentWebviews, and this will give us our 
        // correspondingly associated TextDocumentUriString if we are within the webview, not the TextEditor.  I wish the 
        // vscode API was more sophisticated, but it isn't, so this is what we will have to do.  
        
        // Within the splitWebview function transientActiveDocumentUriString is either defined or undefined.  This is good 
        // because within activeWebviewForDocument we can have a key corresponding to it being defined and a key corresponding 
        // to it being undefined, both of which we set manually as the active webview, within this function as 
        // createOrShowWebview. Within the function as splitWebview we use the following logic.  If 
        // transientActiveDocumentUriString is defined (i.e. not undefined) we are NOT within a webview so we must return 
        // at this point.  Else transientActiveDocumentUriString is undefined, so we are within a webview, so we must firstly 
        // find the currently active webview which will hopefully always correspond to the key as undefined within 
        // activeWebviewForDocument; then we must take this active webview and look up its corresponding document key within 
        // documentWebviews. This key will allow us to decide which bunch of grapes this active webview belongs to.  We need 
        // this information in order to split the Webview else how do we know which bunch of grapes to put the newly created 
        // webview panel into?  If we had open, for example bunch1 associated with doc1, and bunch2 associated with doc2, and 
        // we click onto doc1, then a webview within bunch2, and split it; without this functionality of lookups the webview 
        // from bunch2 would gain a split from bunch1.  This would not be what we desire.  I hope this makes sense.
        this.activeWebviewForDocument.set(undefined, [uniqueViewTypeId, panel]);
        
        return { uniqueViewTypeId: uniqueViewTypeId, panel: panel, newlyCreated: true };
    }

    public splitWebview(viewType: string, title: string): { panelFrom: vscode.WebviewPanel | undefined; panelTo: vscode.WebviewPanel | undefined} {
  
        // We need the panel which was stored in the activeWebviewForDocument Mapping for this 
        // TextDocumentUriString in order to use it later from which to populate the newly created webviewPanel.  

        // We hardcode the key as undefined here, because we cannot assume that transientActiveDocumentUriString has 
        // the meaning as undefined at this point in the code. 

        let anArray;
        if (this.activeWebviewForDocument.has(undefined)){
            anArray = this.activeWebviewForDocument.get(undefined); 
        }

        // As a precautionary measure
        if (!anArray){
            vscode.window.showInformationMessage('Cannot split webview as you need to open a JSON output document from openai whisper and then a webview first');
            return { panelFrom: undefined, panelTo: undefined };
        }
        
        // If we reach here then we can conclude that anArray is not undefined
        let panelFrom = anArray[1];        
 
        // Make sure that the viewType ID is unique by using the same counter as within createOrShowWebview
        const formattedNumber = WebviewManager.webviewCounter.toString().padStart(4, '0');
       
        const uniqueViewTypeId = `${viewType}${formattedNumber}`;         

        // panelNew to be cleaned up within public dispose() and also upon panel.onDidDispose. 

        let panelNew: vscode.WebviewPanel = vscode.window.createWebviewPanel(
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
        

        // We now need to draw our attention to the value of currentActiveDocumentUriString in order to recall the last document 
        // which was selected

        // This variable as transientActiveDocumentUriString was set during our eventListenerDisposable001 within the 
        // activate function 
         
        // So we should, by associating a bunch of a webviews with a SPECIFIC document, collate these and send information from 
        // one webview to all others in the Set when we need to broadcast individual segments from the DOM from one specific 
        // broadcaster to the others in another function which will require that this information will have been stored 

        // The idea behind the following logic is that if no TextEditor has been opened, presentActiveDocumentUriString 
        // will be undefined, but if one is open and one is in focus when the extension starts then hopefully 
        // currentActiveDocumentUriString will have already been set by the createOrShowWebview function 
        if (this.currentActiveDocumentUriString){
            this.addValueToSetOfDocumentWebviews(this.currentActiveDocumentUriString, [uniqueViewTypeId, panelNew], this.documentWebviews);
        } else {
            vscode.window.showInformationMessage('You need to open a JSON output file from openAI whisper speech to text recognition');
        }       

        // To indicate to the calling function that we wish the calling function to return, we return the following to it.
        // The present return will only be invoked if the focus is within an active TextEditor.  Recall that 
        // transientActiveDocumentUriString is set within an eventListener within the activate function, and will be undefined
        // only if we are within a webview, and hence will be defined if we are not (i.e. within a TextEditor)
        if (this.transientActiveDocumentUriString) {
            vscode.window.showInformationMessage('Cannot split webview unless you have one open and in focus'); 
            return { panelFrom: undefined, panelTo: undefined }; } 
        
        // If we reach here in the code we can infer that a webview is currently within focus hence 
        // transientActiveDocumentUriString is undefined ---- IMPORTANT point to think about.
        // If transientActiveDocumentUriString should have been defined then we will never have reached here

        // We must set the activeWebviewForDocument to record the new activeWebviewPanel that has been created.  This is done 
        // so that this active webview will have an association to be used later.  Recall that transientActiveDocumentUriString 
        // is set within the onDidChangeActiveTextEditor callback within eventListenerDisposable001 with the activate function, 
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
        });        
        
        panelNew.onDidDispose(() => {
            // Don't forget to dispose the eventListener disposable!!!
            viewStateDisposable.dispose();

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

        return { panelFrom: panelFrom, panelTo: panelNew};

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
