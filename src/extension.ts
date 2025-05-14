// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { subtitlesEditorProvider } from './subtitlesEditor';
import * as path from 'path';

// 1. Define an EventEmitter to handle your custom event
export const onMyCommandDataEmitter = new vscode.EventEmitter<any>();
export const onMyCommandData = onMyCommandDataEmitter.event;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	console.log('Congratulations, your extension "whisperedit" is now active!');

	// 2. Register your command
	context.subscriptions.push(subtitlesEditorProvider.registerCommands());
	// 4. Register the CustomTextEditorProvider
	context.subscriptions.push(subtitlesEditorProvider.register(context));
}

// This method is called when your extension is deactivated
export function deactivate() {
    // Clean up the event emitter if necessary, though usually not explicitly needed for vscode.EventEmitter
    onMyCommandDataEmitter.dispose();	
}
