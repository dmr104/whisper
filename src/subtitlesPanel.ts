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

    public dispose(){
    }
}
