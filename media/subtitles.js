// Script run within the webview itself.
(function () {

	// Get a reference to the VS Code webview api.
	// We use this API to post messages back to our extension.
	const vscode = acquireVsCodeApi();

	const notesContainer = document.querySelector('.notes');

    const addButtonContainer = document.querySelector('.add-button');
	addButtonContainer.querySelector('button').addEventListener('click', () => {
        addSegmentToSplurge("hello ");
	});

	const splurgeContainer = document.querySelector('.splurge');

    function addSegmentToSplurge(mytext) {
        const segment = document.createElement('div');
        segment.contentEditable="true";
        segment.className = 'seg';
        segment.innerText = mytext;
        splurgeContainer.appendChild(segment);
    }

    // We receive in the webview the message from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        addSegmentToSplurge(message.segment);
      });

}());