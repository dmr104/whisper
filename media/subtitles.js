// Script run within the webview itself.
(function () {

	// Get a reference to the VS Code webview api.
	// We use this API to post messages back to our extension.
	const vscode = acquireVsCodeApi();
	// The undoStack will enable the user to reverse the changes to editing.
	const undoStack = [];

	const splurgeContainer = document.getElementById('splurge');

    function addSegmentToSplurge(mytext, id) {
        const segment = document.createElement('div');
        segment.contentEditable="true";
        segment.className = 'segment';
		segment.id = id;
        segment.innerText = mytext;
        splurgeContainer.appendChild(segment);
    }

	document.getElementById("boldBtn").addEventListener("click", () => applyFormat("bold"));
	document.getElementById("italicBtn").addEventListener("click", () => applyFormat("italic"));
	document.getElementById("underlineBtn").addEventListener("click", () => applyFormat("underline"));      
	// Listener for messages from the extension
	window.addEventListener('message', event => {
		const message = event.data;
		if (message.segment){
			addSegmentToSplurge(message.segment, message.id);
		}
		if (message.command) {
			console.log('From eventlistener message', message.command);
			let useThisButtonId = '';
			switch(message.command) {
			case 'boldButtonClick':
				useThisButtonId = 'boldBtn';
				break;
			case 'italicButtonClick':
				useThisButtonId = 'italicBtn';
				break;
			case 'underlineButtonClick':
				useThisButtonId = 'underlineBtn';
				break;
			case 'undoButtonClick':
				useThisButtonId = 'undoBtn';
				break;	
			default:
				useThisButtonId = 'defaultBtn';
			}
				document.getElementById(useThisButtonId).click(); // Simulate button click
		} 
		

	});
	// To record the initial state onto undoStack we use this flag
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
		  default:
			tag = 'span';
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
		console.log('From applyFormat', undoStack);
	}

		// Undo button logic
		document.getElementById("undoBtn").addEventListener("click", () => {
			console.log('From undoBtn', undoStack);

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

		// the following flag is used to control the logic of the button press
		let changedView=false;
		// allow the user to toggle whether he/she sees the contenteditable divs
		document.getElementById("changeBtn").addEventListener("click", () => {
			// Get a reference to the container div
			const grabbedAgain = document.getElementById('splurge');
			const grabbedButton = document.getElementById('changeBtn');
			if (!changedView){
			// Get all inner divs
			const innerDivs = grabbedAgain.getElementsByTagName('div');
			// Loop through each inner div and add the class
			for (let i = 0; i < innerDivs.length; i++) {
   			innerDivs[i].classList.add('no-decoration'); // Add the class
				};
			grabbedButton.textContent='Go back';
			changedView=true;
			} else {
			// Get all inner divs
			const innerDivs = grabbedAgain.getElementsByTagName('div');
			// Loop through each inner div and add the class
			for (let i = 0; i < innerDivs.length; i++) {
				innerDivs[i].classList.remove('no-decoration'); // Add the class
				};
			grabbedButton.textContent='Change view';
			changedView=false;	
			}
		});


}());