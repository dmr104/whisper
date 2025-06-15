import * as vscode from 'vscode';
import { getNonce } from './util';

export class ActivityWebviewViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'panelWebviewView'; // Must match the ID in package.json
    private _view?: vscode.WebviewView;
    private _currentData: string = "Export";
    private _disposables: vscode.Disposable[] = [];

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(webviewView: vscode.WebviewView){
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            // Restrict the webview to only loading content from our extension's 'media' directory.
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')]          
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Clean up resources when the view is disposed
        webviewView.onDidDispose(() => {
            this._view = undefined;
        });

        const messageDisposable001 = webviewView.webview.onDidReceiveMessage(
            async message => {
                switch (message.type) {
                    case 'buttonPressed':
                        // Invoke the command which exports all file formats
                        try {
                            await vscode.commands.executeCommand('whisperedit.exportAllFormats');
                        } catch (error) {
                            console.error('Error executing command:', error);
                        }               
                        // Update the view with the message as "Exported!"
                        this.updateExplorer(message.data);
                        return;
                }
            },
        );

        this._disposables.push(messageDisposable001); 

    }

    public updateExplorer(newData: string) {
        if (this._view) {
            // Send a message to the webview script to update content
            this._view.webview.postMessage({ command: 'receiveData', data: newData });
        }
    }    

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get the URI for the stylesheet and script to be used in the webview
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'activity_panel.css'));
        const imageUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'rivers100dpiSquare.jpg'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'activity_panel.js'));

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <!--
                Use a content security policy to only allow loading images from https or from our extension directory,
                and only allow scripts that have a specific nonce.
            -->
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            
            <link href="${styleVSCodeUri}" rel="stylesheet">
            <link href="${styleMainUri}" rel="stylesheet">

            <title>My Export Webview</title>
            <style>

            </style>            
        </head>
        <body>
            <div class="image-container">
                <img src="${imageUri}" alt="A picture of birds in trees">
                </div>
            <div>
                <div id="message-receiver"></div>
                <button id="export-button">${this._currentData}</button>
            </div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;

    }

    // Proper cleanup method
    public dispose() {
        // Dispose all event listeners and resources
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }   
}