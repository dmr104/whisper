import * as vscode from 'vscode';

export class SubtitlesWebviewViewProvider implements vscode.WebviewViewProvider{
    private _view?: vscode.WebviewView;
   
    public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, 
        token: vscode.CancellationToken): void {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
        };

        this._view.webview.html = this._getWebviewContent();
        this._updateExplorer(this._getWebviewContent());

        // webviewView.webview.onDidReceiveMessage(
        //     message => {
        //         switch (message.command) {
        //             case 'extractInfo':
        //                 this.updateExplorer(message.data);
        //                 return;
        //         }
        //     },
        //     undefined,
        //     context.subscriptions
        // );
    }
    
    private _getWebviewContent() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Webview View</title>
  
        </head>
        <body>
            <div id="info">Some important information</div>
            <h2>Booglies!</h2>
        </body>
        </html>`;
    }
    
    private _updateExplorer(data: string){
        // Display the extracted data in the explorer
        vscode.window.showInformationMessage(`Extracted Info: ${data}`);        
    }
}