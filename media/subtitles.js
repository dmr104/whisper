// Script run within the webview itself.
(function () {

	// Get a reference to the VS Code webview api.
	// We use this API to post messages back to our extension.
	const vscode = acquireVsCodeApi();
	// The undoStack will enable the user to reverse the changes to editing.
	const undoStack = [];

	const notesContainer = document.querySelector('.notes');
	const splurgeContainer = document.getElementById('splurge');

    const addButtonContainer = document.querySelector('.add-button');
	addButtonContainer.querySelector('button').addEventListener('click', () => {
        addSegmentToSplurge("hello ");
	});


    function addSegmentToSplurge(mytext) {
        const segment = document.createElement('div');
        segment.contentEditable="true";
        segment.className = 'segment';
        segment.innerText = mytext;
        splurgeContainer.appendChild(segment);
    }

    // We receive in the webview the message from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        addSegmentToSplurge(message.segment);
      });

	document.getElementById("boldBtn").addEventListener("click", () => applyFormat("bold"));
	document.getElementById("italicBtn").addEventListener("click", () => applyFormat("italic"));
	document.getElementById("underlineBtn").addEventListener("click", () => applyFormat("underline"));      

	// To record the initial state onto undoStack
	let hasInitialStateBeenSaved = false;

    function applyFormat(type) {

		if (!hasInitialStateBeenSaved) {
			// First user-initiated edit — save initial state
			undoStack.push(splurgeContainer.innerHTML);
			hasInitialStateBeenSaved = true;
		}

        const selection = window.getSelection();
        if (!selection.rangeCount) {
            return;
        }
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
      
        if (selectedText.length === 0) {
            return;
        }
        let tag;
        switch (type) {
          case 'bold':
            tag = 'strong';
            break;
          case 'italic':
            tag = 'em';
            break;
          case 'underline':
            tag = 'u';
            break;
        }

        const wrapper = document.createElement(tag);
        wrapper.textContent = selectedText;

        range.deleteContents();
        range.insertNode(wrapper);
      
        // Move cursor after the inserted node
        range.setStartAfter(wrapper);
        range.setEndAfter(wrapper);
        selection.removeAllRanges();
        selection.addRange(range);

		// Make sure we record this change in order to give the possibility of reversing it.
		undoStack.push(splurgeContainer.innerHTML);
	}
	
		// Undo button logic
		document.getElementById("undoBtn").addEventListener("click", () => {
			
			if (undoStack.length > 1) {
			// Remove current state
			undoStack.pop();
			// Restore previous state
			const previous = undoStack[undoStack.length - 1];
			splurgeContainer.innerHTML = previous;
		
			// Place cursor at the end
			placeCursorAtEnd(splurgeContainer);
			}
		});	  

		function placeCursorAtEnd(el) {
			el.focus();
			const range = document.createRange();
			range.selectNodeContents(el);
			range.collapse(false);
			const sel = window.getSelection();
			sel.removeAllRanges();
			sel.addRange(range);
		}

}());