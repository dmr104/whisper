import * as vscode from 'vscode';
import { getNonce } from './util';

type Segment = {
            "id": number,
            "seek": number,
            "start": number,
            "end": number,
            "text": string,
            "tokens": number[], 
            "temperature": number,
            "avg_logprob": number,
            "compression_ratio": number,
            "no_speech_prob": number
}

type WhisperOutput = {
    text: string;
    language: string;
    segments: Segment[]
}

export class SubtitlesPanel {
    private readonly _context: vscode.ExtensionContext;
    private readonly _extensionUri: vscode.Uri;
    public recordOfMessageData: string = "";

    constructor(context: vscode.ExtensionContext){
        this._extensionUri = context.extensionUri;
        this._context = context;
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

    public async populateWebviewFromFile (document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): Promise<any> {
        try {
            const myJsonData = await this._readFromFile(document);
            // Send data from the extension to the webview in chunks
            for (let i=0; i < myJsonData.segments.length; i++){
                const seg = myJsonData.segments[i];
                webviewPanel.webview.postMessage({ segment: seg.text, id: seg.id});
            }
    
            return myJsonData;
        } catch (error) {
            vscode.window.showErrorMessage("Failed to read JSON data.");
            console.error("Error reading JSON data:", error);
            throw error;
        }
    }

    private async _readFromFile(document: vscode.TextDocument): Promise<any> {
        try {
            const data: WhisperOutput | any | undefined = await vscode.workspace.fs.readFile(document.uri);

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

    public populateWebviewFromDOM(data: string | undefined, panelTo: vscode.WebviewPanel){
        if (data) {
            panelTo.webview.postMessage({ postDataFromExtension: 'grabbedWholeSplurge', data: data });
        }
    }

    // private _myCallback (message: string): Promise<string> {
    //     // Process the message and return the desired data
    //     return new Promise((resolve => {
    //         resolve(message);
    //     }));
    // } 

    // public async updateMainJsonDataRecord(previouslyStoredJsonDataRecord: any, webViewPanel: vscode.WebviewPanel): Promise<any> {
    //     let modifiedJsonDataRecord = previouslyStoredJsonDataRecord;
    //     let universalTextField = "";
        
    //     // Declare dynamicSplurge within the function scope 
    //     let dynamicSplurge: string = ""; 
    //     // Request splurge from the active webview
    //     webViewPanel.webview.postMessage({ getDataFromDOM: 'grabWholeSplurgeFromWebview' });

    //     // Create a new Promise to handle the asynchronous message
    //     await new Promise<void>((resolve) => {
    //         webViewPanel.webview.onDidReceiveMessage(
    //             async message => {
    //                 switch(message.type){
    //                     case 'gotWholeSplurgeFromDOM':
    //                         try {
    //                             // Invoke the callback
    //                             dynamicSplurge = await this._myCallback(message.data);
    //                             resolve();
    //                         } catch (error) {
    //                             console.error('Error in webview message callback:', error);
    //                             vscode.window.showErrorMessage(`Webview error: ${error}`);
    //                         }
    //                         break;
    //                         default:
    //                             vscode.window.showErrorMessage(`An invalid message.type as ${message.type} was received from the webview`);
    //                         break;
    //                         }
    //             },
    //             undefined,
    //             this._context.subscriptions
    //         );
    //      });

    //      // Wait for the promise to resolve
    //      let segments;
    //      // Simple string manipulation.  segments is an array of dynamically altered copied DOM from webview
    //      if (dynamicSplurge){
    //          segments = dynamicSplurge.match(/<div contenteditable="true" class="segment" id="(\d+)">(.*?)<\/div>/g);
    //      } 
    //      if (segments) {
    //          segments.forEach(segment => {
    //              const regex = /<div contenteditable="true" class="segment" id="(\d+)">(.*?)<\/div>/;        
    //              const result = segment.match(regex);
    //              if (result){ // we have a segment of dynamically altered copied DOM from webview
    //                  const [ idMatch, contentMatch ] = result.slice(1);  // The id and content of this segment of DOM from webview
    //                  if (idMatch && contentMatch) { // Now we populate the mainJsonDataRecord with the dynamically updated stuff
    //                      universalTextField = universalTextField.concat("", contentMatch);
    //                      modifiedJsonDataRecord.segments[idMatch].text = contentMatch;
    //                  }
    //              }
    //          });
    //      }
        

    //     // Now we need to update the universal text property as universalTextField of the JSON object as 
    //     // modifiedJsonRecord to make the changes to the JSON object complete.
    //     modifiedJsonDataRecord.text = universalTextField;
    //     console.log('BOOGLIES', modifiedJsonDataRecord);
    //     return modifiedJsonDataRecord;
    // }

    public dispose(){
    }
}
