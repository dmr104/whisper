import * as vscode from 'vscode';
import { SubtitlesPanel } from './subtitlesPanel';
import { SubtitlesWebviewViewProvider } from './subtitlesWebviewViewProvider';
import { WebviewManager, ReturnValue } from './webviewManager';
import { ActivityWebviewViewProvider } from './activitybarWebviewViewProvider';
import { WhisperFormatter } from './outputFileFormatter';

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

    // Subsequent to this, any change to a webview should lead to and cause a matching dynamic granular change 
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

    // The html for the webview is part of the SubtitlesPanel class. So we need an instance of it. We are 
    // creating an html skeleton
    const mySubtitlesPanel = new SubtitlesPanel(context);

    // Initiate the WebviewViewProvider
    const mySubtitlesWebviewViewProvider = new SubtitlesWebviewViewProvider(context.extensionUri);

    //Initiate another for the activity bar button webview view
    const myActivitybarWebviewviewProvider = new ActivityWebviewViewProvider(context.extensionUri);

    // We need this AI generated class to format the outputs in order to export
    const myWhisperFormatter = new WhisperFormatter();

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

        // This is to prevent an error appearing in the console if we initiate createOrShowWebview from 
        // within an srt file, a vtt file, or a text file, or what have you
        if (presentActiveDocumentUriString && /\.json$/i.test(presentActiveDocumentUriString)){
        } else {
            vscode.window.showInformationMessage( 'You need to focus within a JSON file which is the output of openAI whisper before you can view the text within a Webview');
            return;
        }

        if (presentActiveDocumentUriString){
            webviewManager.currentActiveDocumentUriString = presentActiveDocumentUriString;
        } else { 
            vscode.window.showInformationMessage( 'You need to open a JSON file which is the output of openAI whisper before you can view the text within a Webview');
        }

        // We need to extract the first item of the array (which is the value of the key within 
        // webviewManager.primaryWebviewForDocument).  This is in order to obtain the string which is the first 
        // item of the Array within Map<string, [string, vscode.WebviewPanel]>.  We do this in order to access 
        // the recollection of which was the last active TextEditor selected.  If we have selected a non-TextEditor, 
        // i.e. a webviewPanel, then presentActiveDocumentUriString will be undefined and our 
        // registerCommand('createOrShowWebview') will return at this point

        // IMPORTANT USER EXPERIENCE!!!! Whenever the user is within even the primary webview panel, or might be 
        // within a secondary webview panel, or a tertiary or a 4th webpanel (basically anything other than the 
        // TextEditor panel) then rather than jumping Webview panels when the createOrShowWebviewPanel command is invoked, 
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
        // our returnedValue is of form { panel: vscode.WebviewPanel, newlyCreated: boolean}
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
            async message => {
                switch (message.type){
                    case 'webviewReady':

                        // Now it's safe to populate the DOM
                        // presentActiveDocument was defined as a variable near to the beginning of our 
                        // registerCommand('createOrShowWebview'). Its purpose was to store a TextDocument from activeTextEditor.document

                        if (presentActiveDocument){ 
                            let mainJSonDataRecord = await mySubtitlesPanel.populateWebviewFromFile(presentActiveDocument, webviewPanel);
                            console.log(mainJSonDataRecord);

                            // We must also set 
                            webviewManager.primaryWebviewForDocument.set(webviewManager.currentActiveDocumentUriString, [uniqueViewTypeId, webviewPanel]);
                            // This is necessary in order to select the primaryWebviewForDocument being active so that the commands 
                            // bound to the keybindings can be sent to it. 

                            // Note that we set the following to associate a mapping between webviewManager.currentActiveDocumentUriString
                            // and mainJsonDataRecord. 
                            console.log('BRIE CHEESE', webviewManager.currentActiveDocumentUriString);
                     
                            // We need to set a record of the mainJsonDataRecord to use within exportToFile and if the webview reload
                            webviewManager.uriToJsonMapping.set(webviewManager.currentActiveDocumentUriString, mainJSonDataRecord);

                            // primaryWebviewForDocument keeps a paired relationship record of which is the primary webview panel for 
                            // each TextDocument.  We need this importantly in order to select the primary webview panel from the 
                            // TextDocument.  IMPORTANT USER EXPERIENCE!!!! Ought this occur whenever the user is not within the 
                            // primary webview panel --- i.e. might be within a secondary webview panel, or the TextEditor panel?
                            // Answer is no. Rather than jumping Webview panels the UX would be much smoother if nothing happens upon 
                            // a createOrShowWebpanel command after we already have a primary Webview panel.  There should not be any 
                            // jumping around willy-nilly:  the user experience should be a stable one, not cryptic.  To change the
                            //  webview panel the user shall use the mouse or a builtin command perhaps attached to a keybinding.

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
        webviewManager.activeWebviewForDocument.set(presentActiveDocumentUriString, [uniqueViewTypeId, webviewPanel]);
        // This setting to the mapping is crucial because later in splitWebview function we will extract this value by
        // using the key which comes from an eventListener which fires upon when the TextEditor focus moves to a webview, or 
        // a webview moves to a TextEditor, or one TextEditor to another TextEditor, but never from one webview to another
        // no matter what the webviews are.  This key is called webviewManager.transientActiveDocumentUriString
                            
    });

    const eventListenerDisposable001 = vscode.window.onDidChangeActiveTextEditor(editor => {
      
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
        // gives us the flexibility to store the following, only when a transition of focus occurs from a webview to a 
        // TextEditor or from one TextEditor to another one, while the variable as currentActiveDocumentUriString will retain record of
        // the last TextEditor selected
        if (editor){
            webviewManager.transientActiveDocumentUriString = editor.document.uri.toString();
        } else {
            webviewManager.transientActiveDocumentUriString = undefined;
        } 
    });
    
    const commandDisposable002 = vscode.commands.registerCommand('whisperedit.splitWebview', () => {

        let viewType: string = "whisperWebviewPanel";

        let returnedFromSplitPanel: { From: {WvIdFrom: string, panelFrom: vscode.WebviewPanel | undefined}, To: {WvIdTo: string, panelTo: vscode.WebviewPanel | undefined} } = 
                webviewManager.splitWebview(viewType, 'Webview', context);
        
        const IdFrom: string = returnedFromSplitPanel.From.WvIdFrom;
        const IdNew: string = returnedFromSplitPanel.To.WvIdTo;

        const panelFrom: vscode.WebviewPanel | undefined = returnedFromSplitPanel.From.panelFrom;
        const panelNew: vscode.WebviewPanel | undefined = returnedFromSplitPanel.To.panelTo;

        if  (!panelFrom || !panelNew){  // This condition is "unless we have both defined" 
            return;                     // This return prevents us utilizing splitWebview command within a TextEditor
        }

        // Set up message listener BEFORE setting HTML.  The disposable will be pushed onto context.subscriptions.push()
        // and therefore will be automatically cleaned up.  Note that within the javascript run within the webview this 
        // particular eventListener is a wrapper around the other eventListeners.  This is perfectly fine as we are only 
        // calling the outer one the once.  We mirror this coding pattern by putting the all the inner onDidReceiveMessage 
        // within the function populateWebviewFromDOM attached to the webpanel arguments which are passed in as parameters.

        // We establish all the onDidReceiveMessage because we need to be able to handle the response from data sent 
        // prior than sending it.  Its purpose is to initiate the receipt done to the html data from splurge from panelFrom.
        // Note that within the following we have panelFrom, not panelNew. 

        panelNew.webview.onDidReceiveMessage( 
            message => {
                // grab the active webview
                const myActiveWebview = webviewManager.activeWebviewForDocument.get(undefined);

                console.log('myActiveWebview', myActiveWebview);
                let myActiveViewTypeId;
                let myActivePanel;
                if (myActiveWebview){
                    myActiveViewTypeId = myActiveWebview[0];
                    myActivePanel = myActiveWebview[1];
                }
                // find the docUriString key for the active webview
                // which is the key corresponding with the myActiveViewTypeId within the mapping as 
                // webviewManager.documentWebviews with this id for the item within the set
                let myCurrentKey: string | undefined = undefined;

                if (myActiveViewTypeId){
                    myCurrentKey = webviewManager.findKeyByIdFromDocumentWebviews(myActiveViewTypeId, webviewManager.documentWebviews);
                }
                
                // Let's follow the breadcrumbs.  We have obtained the active webview, and have found its corresponding
                // documentUriString from webviewManager.documentWebviews

                // We need to obtain the value as mainJsonDataRecord from the mapping as uriToJsonMapping with the key as 
                // myCurrentKey
        
                let mainJsonDataRecord = webviewManager.uriToJsonMapping.get(myCurrentKey);

                let setOfGrapes: Set<[string, vscode.WebviewPanel]> | undefined = new Set();
                if (myCurrentKey){
                    setOfGrapes = webviewManager.documentWebviews.get(myCurrentKey);
                    
                }
                let myArrayOfGrapes: Array<[string, vscode.WebviewPanel]> = []; 
                if (setOfGrapes){
                    myArrayOfGrapes = Array.from(setOfGrapes);
                }
                const nextWithinArray = myArrayOfGrapes[0];
        
                const nextViewTypeId = nextWithinArray[0];
                const nextWebviewPanel = nextWithinArray[1];

                // Now we wish to find the value within primaryWebviewForDocument for the key within this mapping
                const myValue = webviewManager.primaryWebviewForDocument.get(myCurrentKey);
                let myPrimaryViewTypeId;
                let myPrimaryWebviewPanel;

                if (myValue){
                    myPrimaryViewTypeId = myValue[0];
                    myPrimaryWebviewPanel = myValue[1];
                }
                 
                switch (message.type){
                    case 'webviewReady':
                        nextWebviewPanel.webview.postMessage({ getDataFromDOM: 'grabWholeSplurgeFromWebview' });

                        console.log('IdFrom', IdFrom);
                        console.log('IdNew', IdNew);
                        console.log('myActiveViewTypeId', myActiveViewTypeId);
                        console.log('myActivePanel', myActivePanel);
                        console.log('myPrimaryViewTypeId', myPrimaryViewTypeId);
                        console.log('myPrimaryWebviewPanel', myPrimaryWebviewPanel);
                        console.log('nextViewTypeId', nextViewTypeId);
                        // if (IdFrom === myPrimaryViewTypeId){
                        //     panelFrom.webview.postMessage({ getDataFromDOM: 'grabWholeSplurgeFromWebview' });
                        // }
                        // panelFrom.webview.postMessage({ getDataFromDOM: 'grabWholeSplurgeFromWebview' });
                        console.log('POSTED from', IdFrom, 'to', IdNew);
                        mySubtitlesPanel.populateWebviewFromJson(mainJsonDataRecord, panelNew);
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
                        // Now it's safe to populate the DOM.  We are posting the message.data to panelNew
                        mySubtitlesPanel.populateWebviewFromDOM(message.data, panelNew); 
                        break;
                }
            },
            undefined,
            context.subscriptions   
        );
        
        panelNew.webview.html = mySubtitlesPanel.getHtmlForWebview(panelNew.webview);

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

    // Register the WebviewViewProvider.  This is for the subtitles menu option in the panel
    const webviewViewDisposable001 = vscode.window.registerWebviewViewProvider(SubtitlesWebviewViewProvider.viewType, mySubtitlesWebviewViewProvider);

    // And another one
    const webviewViewDisposable002 = vscode.window.registerWebviewViewProvider(ActivityWebviewViewProvider.viewType, myActivitybarWebviewviewProvider);   
   
    const commandDisposable004 = vscode.commands.registerCommand('whisperedit.exportAllFormats', async () => {
        // Obtain the ACTIVE webviewPanel
        let myValue: [string, vscode.WebviewPanel] | undefined = undefined;
        let uniqueViewTypeId: string | undefined = undefined;

        // Our goal here is to find the active webview for the document and to look up its corresponding documentUriString.
        // We will also be able to read the variable as webviewManager.currentActiveDocumentUriString, and then refer to this
        // variable no matter whichever corresponding webview is opened for this document.

        // The variable as myValue is undefined before any webpanel is opened.  Thereafter (but before we refer to it) it 
        // keeps a record of the most recent active webviewpanel, even if we (previously to reading it) go back to focus the 
        // Texteditor panel
        if (webviewManager.activeWebviewForDocument.has(webviewManager.transientActiveDocumentUriString)){
            myValue = webviewManager.activeWebviewForDocument.get(webviewManager.transientActiveDocumentUriString);
        }
       
        // We need also to obtain the webViewPanel, and that as the uniqueViewTypeId.
        let webViewPanel;
        if (myValue){
            uniqueViewTypeId = myValue[0];
            webViewPanel = myValue[1];
        }

        // Now we will find the key corresponding with the uniqueViewTypeId within the mapping as 
        // webviewManager.documentWebviews with this id for the item within the set
        let myCurrentKey: string | undefined = undefined;

        if (uniqueViewTypeId){
            myCurrentKey = webviewManager.findKeyByIdFromDocumentWebviews(uniqueViewTypeId, webviewManager.documentWebviews);
        }

        // Let's follow the breadcrumbs.  We have obtained the active webview, and have found its corresponding
        // documentUriString from webviewManager.documentWebviews

        // We need to obtain the value as mainJsonDataRecord from the mapping as uriToJsonMapping with the key as 
        // myCurrentKey
        
        let mainJsonDataRecord = webviewManager.uriToJsonMapping.get(myCurrentKey);

        // Now we need to update the content of mainJsonDataRecord accordingly from the webviewPanel. 
        // Note that we shall also modify the universal text property of the JSON object


        let universalTextField = "";
        let dynamicSplurge = "";

        // Here is where the main logic of our exportAllFormat commences
        if (webViewPanel  && mainJsonDataRecord){
            // We need to set an eventListener as onDidReceiveMessage upon the webview.
            webViewPanel.webview.onDidReceiveMessage( message => {
                switch (message.type) {
                    case 'anotherGotWholeSplurgeFromDOM':

                        //vscode.window.showInformationMessage(`Got event from onDidReceiveMessage`);
                        dynamicSplurge = message.data;
        
                        let segments;
                        // Simple string manipulation.  segments is an array of dynamically altered copied DOM from webview
                        segments = dynamicSplurge.match(/<div contenteditable="true" class="segment" id="(\d+)">(.*?)<\/div>/g);
            
                        if (segments) {
                            segments.forEach(segment => {
                                const regex = /<div contenteditable="true" class="segment" id="(\d+)">(.*?)<\/div>/;        
                                const result = segment.match(regex);
                                if (result){ // we have a segment of dynamically altered copied DOM from webview
                                    const [ idMatch, contentMatch ] = result.slice(1);  // The id and content of this segment of DOM from webview
                                    if (idMatch && contentMatch) { // Now we populate the mainJsonDataRecord with the dynamically updated stuff
                                        universalTextField = universalTextField.concat("", contentMatch);
                                        mainJsonDataRecord.segments[idMatch].text = contentMatch;
                                    }
                                }
                            });
                        }
                        mainJsonDataRecord.text = universalTextField;
        
                        // Now we need to write the amended modifiedJsonDataRecord to within the mapping as primaryWebviewForDocument
                        if (uniqueViewTypeId){
                            webviewManager.activeWebviewForDocument.set(myCurrentKey, [uniqueViewTypeId, webViewPanel]);    
                        }
        
                        // Now, first we write the data structure as modifiedJsonDataRecord to the disk.  In order to do this and to write to other 
                        // exported data outputs we will need the Uri as the path and the filename minus the extension part.  
                      
                        let extractedJsonUri;
                        if (myCurrentKey){
                            extractedJsonUri = vscode.Uri.parse(myCurrentKey);
                        }
                        
                        const extractedJsonPath = extractedJsonUri?.fsPath;
        
                        const basePath = extractedJsonPath?.replace(/\.[^/.]+$/, "");
        
                        const srtUri = vscode.Uri.file(`${basePath}.srt`); 
                        const vttUri = vscode.Uri.file(`${basePath}.vtt`);
                        const txtUri = vscode.Uri.file(`${basePath}.enriched.txt`);
                        const plainTxtUri = vscode.Uri.file(`${basePath}.plain.txt`); 
                        const dummyUri = vscode.Uri.file(`${basePath}.json`);
                        const htmlUri = vscode.Uri.file(`${basePath}.html`);
                        
                        const encoder = new TextEncoder();
        
                        // The following command is an accessor function which loads the data into the 
                        // instance of the class as WhisperFormatter.  
                        myWhisperFormatter.inputMainJsonDataRecord(mainJsonDataRecord);
                        
                        // I choose not to hide all my functionality with a cryptic to read helper function
                        // because I like to be able to see what is going on iteratively. 
        
                        // SRT
                        try {
                            const srtFormatted = myWhisperFormatter.toSRT();
                            const data = encoder.encode(srtFormatted);
                            vscode.workspace.fs.writeFile(srtUri, data);
                            // console.log(`srt file saved successfully to: ${srtUri.fsPath}`);
                        } catch (error) {
                            console.error('Error saving srt file:', error);
                            vscode.window.showErrorMessage(`Failed to save srt file: ${error}`);
                        }
        
                        // VTT
                        try {
                            const vttFormatted = myWhisperFormatter.toVTT();
                            const data = encoder.encode(vttFormatted);
                            vscode.workspace.fs.writeFile(vttUri, data);
                            // console.log(`vtt file saved successfully to: ${vttUri.fsPath}`);
                        } catch (error) {
                            console.error('Error saving srt file:', error);
                            vscode.window.showErrorMessage(`Failed to save srt file: ${error}`);
                        }
        
                        // TXT -- Note that this will contain the html strong, italics and underline 
                        // tags for easy export of the html source to be imported into browsers or what 
                        // have you.  The presumption being that if the user should not want these tags 
                        // then he/she would not have used them in the first place. So we don't wish to 
                        // lose them.  To lose them would be a trivial case of using html.textContent on
                        // mainJsonDataRecord.text, which we will do also in the plain.txt file which is output.
                        try {
                            const data = encoder.encode(mainJsonDataRecord.text);
                            vscode.workspace.fs.writeFile(txtUri, data);
                            // console.log(`enriched txt file saved successfully to: ${txtUri.fsPath}`);
                        } catch (error) {
                            console.error('Error saving srt file:', error);
                            vscode.window.showErrorMessage(`Failed to save srt file: ${error}`);
                        }
        
                        // PLAIN.TXT
                        try {
                            const regexp = /<(strong|em|u)\b[^>]*>(.*?)<\/\1>/g;
                            const strippedText = mainJsonDataRecord.text.replace(regexp, (match: string, p1: string, p2: string): string => p2);
                            const data = encoder.encode(strippedText);
                            vscode.workspace.fs.writeFile(plainTxtUri, data);
                            // console.log(`plain text file saved successfully to: ${plainTxtUri.fsPath}`);
                        } catch (error) {
                            console.error('Error saving srt file:', error);
                            vscode.window.showErrorMessage(`Failed to save srt file: ${error}`);
                        }
        
                        // JSON
                        try {
                            const jsonString = JSON.stringify(mainJsonDataRecord);
                            const data = encoder.encode(jsonString);
        
                            // Write the file
                            if (extractedJsonUri){
                                vscode.workspace.fs.writeFile(dummyUri, data);
                                // console.log(`JSON file saved successfully to: ${dummyUri.fsPath}`);
                            }
        
                        } catch (error) {
                            console.error('Error saving JSON file:', error);
                            vscode.window.showErrorMessage(`Failed to save JSON file: ${error}`);
                        }        
                        
                        // HTML
                        const UserWordTemplate = 'UserWordTemplate.html';
                        try {
                            // Create URI for the template file
                            const templateUri = vscode.Uri.joinPath(
                                context.extensionUri, 
                                'MSWordTemplate', 
                                UserWordTemplate
                            );
                            const htmlStringPromise = ( async () => {
                                try {
                                    // Read file using VS Code's file system API
                                    const fileData = await vscode.workspace.fs.readFile(templateUri);
                                    let htmlContent = Buffer.from(fileData).toString('utf8');
                                    const regex = new RegExp(`\\$\\{booglies\\}`, 'g');
                                    
                                    //const regex = new RegExp(`paragraph`, 'g');
                                    htmlContent = htmlContent.replace(regex, mainJsonDataRecord.text);   
                                    // console.log('htmlContent is ', htmlContent);
                                    return htmlContent;
        
                                } catch (error){
                                    throw new Error(`Failed to load template: ${error}`);
                                }
                            })();
        
                            htmlStringPromise.then((htmlContent) => {
                                const data = encoder.encode(htmlContent);
                                vscode.workspace.fs.writeFile(htmlUri, data);
                                // console.log(`html file saved successfully to: ${htmlUri.fsPath}`);
                            })
                            .catch(error => {throw new Error(`Error within Promise htmlStringPromise ${error}`);});
        
                        } catch (error) {
                            console.error('Error saving html file:', error);
                            vscode.window.showErrorMessage(`Failed to save html file: ${error}`);
                        }
                }
            });      
            // Request splurge from the active webview.  This event is crucial.  It triggers the webview to send back to the 
            // extension the splurge data. I have put this after I have set up the listeners within the webview for the reply 
            // received.  Note that we still must have had ((webViewPanel  && mainJsonDataRecord) === true) to 
            // have had arrived here
            webViewPanel.webview.postMessage({ getDataFromDOM: 'anotherGrabWholeSplurgeFromWebview' });

        } else {
            vscode.window.showInformationMessage('We require a webview panel to have been already opened before an Export to file');
        }

    });

    context.subscriptions.push(webviewManager, mySubtitlesPanel, commandDisposable001, 
        eventListenerDisposable001 ,commandDisposable002, commandDisposable003, 
       webviewViewDisposable001, webviewViewDisposable002, commandDisposable004);
    
}

export function deactivate() {
}

