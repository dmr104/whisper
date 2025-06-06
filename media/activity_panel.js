(function (){
    const vscode = acquireVsCodeApi();
    
    const exportButton = document.getElementById('export-button');
    const messageReceiver = document.getElementById('message-receiver');
    
    exportButton.addEventListener('click', () => {
        vscode.postMessage({
            type: 'buttonPressed',
            data: 'Exported!'
        });
    });
    
    let timeoutId = null; // Variable to hold the timeout ID
    let isShowing = false; // Flag to track visibility

    window.addEventListener('message', (event) => {
        if (isShowing) { return; }; // Prevent further clicks if already showing
        message = event.data;
   
        // Add visible class to apply styles
        messageReceiver.classList.remove('hidden');
        messageReceiver.classList.add('visible');
        isShowing = true; // Set flag to true

        if (message.command === 'receiveData') {   
            messageReceiver.textContent = message.data; 
        }

        timeoutId = setTimeout(() => {
            messageReceiver.textContent = '';
            messageReceiver.classList.remove('visible');
            messageReceiver.classList.add('hidden');
            isShowing = false; // Reset flag when done            
        }, 5000);
    });

}());