// This script runs inside the webview for the explorer

// Get a reference to the VS Code API specific to the webview
// This allows the webview to post messages back to the extension
const vscode = acquireVsCodeApi();

window.addEventListener('message', event => {
    
    const message = event.data; // The json data that the extension sent
    switch (message.command) {
        case 'receiveData':
            const dataDisplay = document.getElementById('data-display');
            if (dataDisplay) {
                    dataDisplay.innerHTML = message.data;
                }
                break;
            // Add more cases as needed for other commands from the extension
        }     
});