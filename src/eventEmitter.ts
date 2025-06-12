import * as vscode from 'vscode';

export class EventEmitter {
    // Create an EventEmitter
    private _onDidChange = new vscode.EventEmitter<string>();
    
    // Expose the Event (read-only)
    readonly onDidChange: vscode.Event<string> = this._onDidChange.event;
    
    // Method that triggers the event
    doSomething(message: string) {
        
        // Fire the event
        this._onDidChange.fire(message);
    }
    
    // Don't forget to dispose!
    dispose() {
        this._onDidChange.dispose();
    }
}