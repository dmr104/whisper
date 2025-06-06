import * as vscode from 'vscode';
import { getNonce } from './util';

export class SubtitlesWebviewViewProvider implements vscode.WebviewViewProvider{
    public static readonly viewType = 'subtitlesWebviewView'; // Must match the ID in package.json
    private _view?: vscode.WebviewView;
    private _currentData: string = "Keep this open for nice functionality";
    private _disposables: vscode.Disposable[] = [];

    constructor(private readonly _extensionUri: vscode.Uri) {}
   
    public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext<unknown>, 
        token: vscode.CancellationToken): void | Thenable<void> {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            // Restrict the webview to only loading content from our extension's 'media' directory.
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')]          
        };

        this._getWebviewHtml();

        // We are not receiving any messages from the explorer's webview.  Hence the transaction is 
        // one way.  We send to this webview from the extension.
        
        // Clean up resources when the view is disposed
        webviewView.onDidDispose(() => {
            this._view = undefined;
        });

       // this._updateExplorer(this._getWebviewHtml());

        const messageDisposable001 = webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'updateExplorer':
                        this.updateExplorer(message.data);
                        return;
                }
            },
        );

        this._disposables.push(messageDisposable001);
    }
    
    /**
     * Updates the data displayed in the webview which is within the explorer.
     * This can be called from anywhere in your extension (e.g., by a command).
     */
    public updateExplorer(newData: string) {
        this._currentData = newData;
        if (this._view) {

            // Send a message to the webview script to update content
            this._view.webview.postMessage({ command: 'receiveData', data: this._currentData });
        }
    }

    private _getWebviewHtml() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }
    
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get the URI for the stylesheet and script to be used in the webview
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'explorer.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'explorer.js'));

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

    <title>My Explorer Webview</title>
</head>
<body>
    <p id="data-display">${this._currentData}</p>

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