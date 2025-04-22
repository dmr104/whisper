import * as vscode from 'vscode';
import { getNonce } from './util';

export class subtitlesEditorProvider implements vscode.CustomTextEditorProvider {


	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new subtitlesEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(subtitlesEditorProvider.viewType, provider);
		return providerRegistration;
	}

	private static readonly viewType = 'whisperedit.subtitles';

	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> { 
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
    }    

    /**
	 * Get the static html used for the editor webviews.
	 */
    private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to script and css for the webview        
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'catScratch.js'));

		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'reset.css'));

		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'vscode.css'));

		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'subtitles.css'));

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
				<div class="notes">
					<div class="add-button">
						<button>Scratch!</button>
					</div>
				</div>
				
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;            
    }        
}

