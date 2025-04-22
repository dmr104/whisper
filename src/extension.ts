// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "whisperedit" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable001 = vscode.commands.registerCommand('whisperedit.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello David from WhisperEdit!');
	});

	async function selectFile(): Promise<vscode.Uri | undefined> {
		const fileUris = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			openLabel: 'Select File'
		});
	
		if (fileUris && fileUris.length > 0) {
			return fileUris[0];
		}
	
		return undefined;
	}

	const disposable002 = vscode.commands.registerCommand('whisperedit.openMultipleFiles', async () => {
		const TARGET_EXTENSIONS = ['.json', '.srt', '.tsv', '.txt', '.vtt'];	
		const fileUri = await selectFile();
		if (fileUri) {
			const filePath = fileUri.path;
			// Find the last index of '/'
			const lastSlashIndex = filePath.lastIndexOf('/');
			// Slice the string to get everything up to the last '/'
			const folder = filePath.slice(0, lastSlashIndex + 1);
			const fileName = filePath.split('/').pop();
			const baseName = fileName?.split('.')[0];
			console.log(folder);
			console.log(fileUri.path.split('/').pop());
			// Get all files in the folder
			const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(folder));
		
      	  	// Filter to only files with the same base name but different extensions
        	const matchingFiles = files
            .filter(([name, type]) =>
                type === vscode.FileType.File &&
                name.startsWith(baseName + '.') 
            )
            .map(([name]) => vscode.Uri.file(path.join(folder, name)));			
			console.log('files is ', files);
			console.log(matchingFiles);
			for (const fileUri of matchingFiles) {
				await vscode.window.showTextDocument(fileUri, { preview: false, preserveFocus: true });
			}	
		} else {
			vscode.window.showWarningMessage('No file selected');
		}
	});

	context.subscriptions.push(disposable001, disposable002);
}

// This method is called when your extension is deactivated
export function deactivate() {}
