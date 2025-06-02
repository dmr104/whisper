import * as vscode from 'vscode';
import { SubtitlesPanel } from './subtitlesPanel';
import { SubtitlesWebviewViewProvider } from './SubtitlesWebviewViewProvider';
import { WebviewManager, ReturnValue } from './webviewManager';

export function activate(context: vscode.ExtensionContext){

    // The first time a webview is populated we want to read from the file on disk.
    // When a webview is split we populate the new webview from the one which 
    // was split.

    // ----------
    // | webview |--
    // ----------  /|\
    //      |       |                           ------
    //     \|/       --------------------------| disk |
    // ----------                               ------
    // | webview |
    // ----------

    // Subsequent to this, any change to webview should lead to and cause a matching dynamic granular change 
    // sent to all other webviews.
    
    // WebviewManager is an implementation of vscode.Disposable;  this makes things very convienient as 
    // the disposable done to documentWebviews is managed within it.  The public dispose() method is called when 
    // webviewManager is disposed, and the .onDidDipose within createOrShowView deletes a key-value pair 
    // when the webview becomes closed manually or programmatically individually.

    // The instance of the WebviewManager lingers and survives after the lifetime of the activate function has expired.  
    // This is essential because references to functional informational state information are kept within the following 
    // instances of these classes many of which need to be referred to AFTER the active() function is completed.

    // The class as WebviewManager contains such state informational variables as the variable as 
    // currentActiveDocumentUriString

    // The WebviewManager is one of the main dudes in our programming arsenal   
    const webviewManager = new WebviewManager();

    // The html for the webview is part of the SubtitlesPanel class. So we need an instance of it. We are creating an html skeleton
    const mySubtitlesPanel = new SubtitlesPanel(context.extensionUri);

    // Initiate the WebviewViewProvider
    const mySubtitlesWebviewViewProvider = new SubtitlesWebviewViewProvider(context.extensionUri);
    
    const commandDisposable001 = vscode.commands.registerCommand("whisperedit.createOrShowWebview", () => {
                                  // I M P O R T A N T ! ! ! ! 
        // We want that each each webview creation will only happen once.  Thereafter we will 
        // run the command splitWebview if we want another webView by any TextDocument. This is a good 
        // user experience. If the user runs createOrShowWebview from an active webview then 
        // activeTextEditor becomes the value as undefined.

        // This will allow us to decide whether the focus is within a webview or the TextEditor.    
       
        const presentActiveTextEditor: vscode.TextEditor | undefined  = vscode.window.activeTextEditor;
        const presentActiveDocument: vscode.TextDocument | undefined = presentActiveTextEditor?.document;
        const presentActiveDocumentUriString: string | undefined = presentActiveDocument?.uri.toString();

        if (presentActiveDocumentUriString){
            webviewManager.currentActiveDocumentUriString = presentActiveDocumentUriString;
        } else { vscode.window.showInformationMessage( 'You need to open a JSON file which is the output of openAI whisper before you can view the text within a Webview');}

        // We need to extract the first item of the array (which is the value of the key within 
        // webviewManager.primaryWebviewForDocument).  This is in order to obtain the string which is the first 
        // item of the Array within Map<string, [string, vscode.WebviewPanel]>.  We do this in order to access 
        // the recollection of which was the last active TextEditor selected.  If we have selected a non-TextEditor, 
        // i.e. a webviewPanel, then presentActiveDocumentUriString will be undefined and our 
        // registerCommand('createOrShowWebview') will return at this point

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
                    case 'updateText':
                        webviewManager.broadcastToOtherWebviews(message.id, message.segmentHTML, webviewPanel);
                    break;
                    case 'sendToWebviewView':
                        mySubtitlesWebviewViewProvider.updateExplorer(message.segmentHTML);
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
        // This setting to the mapping is crucial because later in splitWebview function we will extract this value by
        // using the key which comes from an eventListener which fires upon when the TextEditor focus moves to a webview, or 
        // a webview moves to a TextEditor, or one TextEditor to another TextEditor, but never from one webview to another
        // no matter what the webviews are.  This key is called webviewManager.transientActiveDocumentUriString
    });

    const eventListenerDisposable001 = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor){
            webviewManager.transientActiveDocumentUriString = editor.document.uri.toString();
        } else {
            webviewManager.transientActiveDocumentUriString = undefined;
        }
        // The API of onDidChangeACtiveTextEditor says "An Event which fires when the active editor has changed. Note that 
        // the event also fires when the active editor changes to undefined". From my own investigations I note that when the 
        // TextEditor is deselected (i.e. a webview IS selected) then the event.document.uri.toString() will also be undefined, 
        // where event is a TextEditor.  According to the API  "onDidChangeActiveTextEditor: Event<TextEditor | undefined>". 
        // This event will not fire when one webview is focused from another webview irregardless of which webviews these are.  
        // It will only fire when a TextEditor becomes focused from a webview, or a webview becomes focused from a TextEditor, or 
        // one TextEditor becomes focused from a different TextEditor.
        
        // To record the last record of this behaviour in a variable as currentActiveDocumentUriString is especially useful as it allows
        // us to fathom which TextEditor was last selected.  This may seem it is a duplication of information which is recorded 
        // within the variable as transientActivedocumentUriString, but it is not.  It is not because currentActiveDocumentUriString 
        // will retain state after the focus of the document whose information it records is lost, while 
        // transientActiveDocumentUriString will lose its state at this point.  Therefore transientActiveDocumentUriString 
        // gives us the flexibility to store only the following only when a transition of focus occurs from a webview to a 
        // TextEditor or from one TextEditor to another one, while the variable as currentActiveDocumentUriString will retain record of
        // the last TextEditor selected
    });
    
    const commandDisposable002 = vscode.commands.registerCommand('whisperedit.splitWebview', () => {

        let viewType: string = "whisperWebviewPanel";

        let returnedFromSplitPanel: { panelFrom: vscode.WebviewPanel | undefined; panelTo: vscode.WebviewPanel | undefined } = 
        webviewManager.splitWebview(viewType, 'Webview');
        
        const panelNew: vscode.WebviewPanel | undefined= returnedFromSplitPanel.panelTo;
        const panelFrom: vscode.WebviewPanel | undefined = returnedFromSplitPanel.panelFrom;

        if  (!panelFrom || !panelNew){  // This condition is "unless we have both defined" 
            return;                     // This return prevents us utilizing splitWebview command within a TextEditor
        }

        // Set up message listener BEFORE setting HTML.  The disposable will be pushed onto context.subscriptions.push()
        // and therefore will be automatically cleaned up.  Note that within the javascript run within the webview this 
        // particular eventListener is a wrapper around the other eventListeners.  This is perfectly fine as we are only 
        // calling the outer one the once.  We mirror this coding pattern by putting the all the inner onDidReceiveMessage 
        // within the function populateWebviewFromDOM attached to the webpanel arguments which are passed in as parameters.

        // We establish all the onDidReceiveMessage because we need to be able to handle the response from data sent 
        // prior than sending it.  Note that the within the following internal we have panelFrom, not panelNew. 
        // Its purpose is to initiate the receipt done to the html data from splurge from panelFrom. 

        panelNew.webview.onDidReceiveMessage( 
            message => {
                switch (message.type){
                    case 'webviewReady':
                        panelFrom.webview.postMessage({ getDataFromDOM: 'grabWholeSplurgeFromWebview' });
                        break;
                    case 'updateText':
                        webviewManager.broadcastToOtherWebviews(message.id, message.segmentHTML, panelNew);
                        break;
                    case 'sendToWebviewView':
                        mySubtitlesWebviewViewProvider.updateExplorer(message.segmentHTML);
                        break;                                       
                };
                
            },
            undefined,
            context.subscriptions             
        );
        
        // Be aware that the DOM has already been setup by the time 'gotWholeSplurgeFromDOM' is received. 
        // We must deal with panelFrom
         
        panelFrom.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'gotWholeSplurgeFromDOM':
                        // We need to receive the whole splurge from the panelFrom
                        // Now it's safe to populate the DOM
                        mySubtitlesPanel.populateWebviewFromDOM(message.data, panelNew); 
                        break;
                }
            },
            undefined,
            context.subscriptions   
        );
        
        panelNew.webview.html = mySubtitlesPanel.getHtmlForWebview(panelNew.webview);
        
        // We now have received the data from the webview to the extension.

        // We can set a disposable onDidChangeViewState upon the webviewPanel panelNew
    });

    const commandDisposable003 = vscode.commands.registerCommand('whisperedit.triggerButtonClick', (args) => {
    // We want to invoke the commands as specified from package.json by the relevant webview only.  Each has a 
    // unique webviewId. We have access to the currently active webview which is stored within the array value 
    // of webviewManager.activeWebviewForDocument: Map<string | undefined, [ uniqueViewTypeId, webviewPanel ]> 
    // with the corresponding key as undefined. 

    // So let's get this active webview and issue it with the data of each command each time its associated 
    // keypress happens.

        let theWebviewPanel: vscode.WebviewPanel | undefined;
        // Firstly, grab the current DocumentUriString
        if (webviewManager.activeWebviewForDocument.has(undefined)){
            let myValueArray = webviewManager.activeWebviewForDocument.get(undefined);
            if (myValueArray){
                theWebviewPanel = myValueArray[1];
            }
        }
          
        // A bound press has been pressed.  Send the command to the webview.
        theWebviewPanel?.webview.postMessage({ command: args.command });
        
        vscode.window.showInformationMessage(`triggerButtonClick executed with options ${args.command}`);

	});

    // Register the WebviewViewProvider
    const webviewViewDisposable001 = vscode.window.registerWebviewViewProvider(SubtitlesWebviewViewProvider.viewType, mySubtitlesWebviewViewProvider);

    context.subscriptions.push(webviewManager, mySubtitlesPanel, commandDisposable001, 
        eventListenerDisposable001 ,commandDisposable002, commandDisposable003, 
        webviewViewDisposable001);
    
}

export function deactivate() {
}


