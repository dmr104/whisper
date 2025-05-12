// Script run within the webview itself.
(function () {

	// Get a reference to the VS Code webview api.
	// We use this API to post messages back to our extension.
	const vscode = acquireVsCodeApi();
	// The undoStack will enable the user to reverse the changes to editing.
	const undoStack = [];

	// The following variable is for if we select a div we are currently within via an input.
	let storedDivId = null;

	// The following is used to pass the event.target.id of where the mouse is clicked to applyFormat
	let clickDivId;

	// The following stores the outerhtml of a text element.  used on mousedown.
	let mygrabbedFromDom;

	// the following flag is used to control the logic of the change style button press
	let changedView=false;	

	// The following is used in the function addSegmentToSplurge
	const splurgeContainer = document.getElementById('splurge');

	document.getElementById("boldBtn").addEventListener("click", (e) => {
		applyFormat("bold");
	}
		
	);
	document.getElementById("italicBtn").addEventListener("click", () => applyFormat("italic"));
	document.getElementById("underlineBtn").addEventListener("click", () => applyFormat("underline"));
	// allow the user to toggle whether he/she sees the contenteditable divs
	document.getElementById("changeBtn").addEventListener("click", () =>  applyChangeButton());
	
	// Undo button logic
	document.getElementById("undoBtn").addEventListener("click", () => processOnUndoButton());	

	// Listener for messages from the extension. This function responds ultimately to the keybindings.
	window.addEventListener('message', event => {
		populateSplurge(event);
		processButtonClick(event);
	});

	splurgeContainer.addEventListener('input', (e) => {
		processInput(e);

		// Make sure we send an update to the extension from the webView every time a key is input.
		updateToExt(e);
	});
	
	splurgeContainer.addEventListener('mousedown', (e) => {
		processMouseClick(e);
	});

	function updateToExt(event){
		target = event.target;
		myID = target.id;
		console.log('TARGET from updateToExt is ', target);
		myTextContentHTML = target.innerHTML;
		console.log('target.innerHTML is ', myTextContentHTML);
		myTextContentInner = target.innerText;
		console.log('target.innerText is ', myTextContentInner);

		// The following is to update the extension from the webview each time a key is pressed.
		processUpdateToExt(myID, myTextContentInner, myTextContentHTML);
	}

	function processUpdateToExt(myID, myInnerText, myHTML) {
		vscode.postMessage({ 
			type: 'updateText',
			id: myID,
			textInner: myInnerText,
			textHTML: myHTML 
		});
	}

	function anotherUpdateToExt () {			
		// The following is to grab the modified div in order to update the extension from the webView each 
		// time a formatting occurs (bold, italics, underline).

		// Set the innerHTML of a variable to the provided outerHTML from a global variable.
		let tempDiv = document.createElement('div');
		tempDiv.innerHTML = mygrabbedFromDom;
		let myStoredDiv = tempDiv.firstElementChild;
		console.log('Andromeda ', myStoredDiv);

		const divID = myStoredDiv.id;
		let afterStoredDiv = document.getElementById(divID);
		// We pass three fields of information from the webview to the extension.
		const myID = afterStoredDiv.id;
		const divInnerHTML = afterStoredDiv.innerHTML;
		const divInnerText = afterStoredDiv.innerText;
		console.log('HOORAY!', afterStoredDiv);
		console.log('Frogs in trees ', myID, divInnerText, divInnerHTML);
		processUpdateToExt(divID, divInnerText, divInnerHTML);

	}

	function applyFormat(type) {
		// We store this div from the DOM in case we click a formatting button 
		// with the text highlighted within a previously formatted bit
		let storeThisDiv = document.getElementById(clickDivId);
		const theStoredDiv = storeThisDiv.outerHTML;
		console.log('theStoredDiv is ', theStoredDiv);
		console.log('storeThisDiv ', storeThisDiv);

		// Get the element where the cursor is located
		const selection = window.getSelection();

		if (!selection.rangeCount) {
			return;
		}

		const range = selection.getRangeAt(0);
	

		// Store the start and end positions.  It is important to realise that we grab a node from the parent using
		// parent.childNodes[i], but first we need to obtain the parent from where the cursor was located
	    // The following produces the actual text of the node.  use .parent to obtain the parent.
		const startContainer = range.startContainer;
		const startOffset = range.startOffset;
		const endContainer = range.endContainer;
		const endOffset = range.endOffset;

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

		// Get the common ancestor
		// The following is to find the div containing where the mouse was clicked.  
		// This is done in order to decide whether the commonancestor has an id, if 
		// it does then we have a div not a strong, italic, or underline
		const commonAncestor = range.commonAncestorContainer;
		console.log('commonAncestor is', commonAncestor);

		// Find the index of the text node
		const children = commonAncestor.childNodes;	
		let index = -1;
		for (let i = 0; i < children.length; i++) {
			if (children[i] === startContainer) {
				index = i;
				break;
			}
		}
		
		// Log the index
		console.log('Text node index in common ancestor children:', index);


		// Store the initial cursor position
		const cursorState = {
	        startContainer: startContainer,
			startOffset: startOffset,
			endContainer: endContainer,
			endOffset: endOffset,
			nodeIndex: index
		};		
		
		console.log('cursorState', cursorState);

		if (commonAncestor && commonAncestor.id) {			
			// Make sure we record this change in order to give the possibility of reversing it.
			undoStack.push({
				id: commonAncestor.id, 
				cursor: cursorState, 
				blobHTML: mygrabbedFromDom});
			// Make sure that the update to the DOM is transmitted from webview to extension.
			anotherUpdateToExt();	
		} else {
				storeThisDiv.innerHTML = theStoredDiv;
				performUndoEventFormat('do');
				console.log('Return now', undoStack);
		}

		console.log('Last on undostack is ', undoStack[undoStack.length - 1]);
		console.log('range is ', range);
		
		console.log('selection is ', selection);
		console.log(undoStack);

	}


	const populateSplurge = function(ev) {
		const message = ev.data;
		if (message.segment){
			addSegmentToSplurge(message.segment, message.id);
		}
	};

	const processButtonClick = function(ev) {
		const message = ev.data;
		
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
	};

	const processMouseClick = function (event) {
		let target = event.target;

		// move up to the div element with an id on it
		while (!target.id){
			target = target.parentNode;
		}

		// clickDivId is global, as is mygrabbedFromDom which being a string is passed by value.
		// We can use this fact to reconstruct an HTMLELement in the function anotherUpdatetoExt.
		clickDivId = target.id;
		let grabbedFromDom = document.getElementById(clickDivId);
		mygrabbedFromDom = grabbedFromDom.outerHTML;
		// clickDivId and storedDivId are globally scoped

		console.log('storedDivId is ', storedDivId);
		console.log('clickDivId is ', clickDivId);
		console.log('target is ', target);		

	};

	const processInput = function (event) {
        
		const target = event.target;
		const inputDivId= target.id;

		if (storedDivId === null) { // No ID is currently stored

			undoStack.push({
				id: target.id,
				blobHTML: mygrabbedFromDom});
			console.log('CHICKEN', undoStack);
			storedDivId = inputDivId;

		} else { // An ID is already stored
				
			if (storedDivId !== inputDivId) {  // No match. Have moved to another box.	
				undoStack.push({
					id: target.id,
					blobHTML: mygrabbedFromDom});
				console.log('HEN', undoStack);
					
				//Now update the storedDivId
				storedDivId = inputDivId;
					
			} 
		}
		
	};

    function addSegmentToSplurge(mytext, id) {
        const segment = document.createElement('div');
        segment.contentEditable="true";
        segment.className = 'segment';
		segment.id = id;
        segment.innerText = mytext;
        splurgeContainer.appendChild(segment);
    }
	

	function applyChangeButton () {
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
	}

	function processOnUndoButton () {
		
		// Deselect the already selected text
		const selection = window.getSelection();
		selection.removeAllRanges();

		if (undoStack.length === 0){
			storedDivId = null;  //reset to start stack at the beginning
		} else {  // undoStack length is greater than 0
			const lastOnStack = undoStack[undoStack.length - 1];
			// Logic is for smooth user experience depending upon where they left off when undo was pressed
			if ('cursor' in lastOnStack) {	
					// if the last on stack was from a formatting alteration

					console.log('A b/it/u alteration');
					performUndoEventFormat();

			} else { 
				// if the last on stack is from a text alteration change

					console.log('A text alteration ');					
					performUndoEventTextChange();
				}
			undoStack.pop();
			console.log('donkeys', undoStack);
			// Make sure we update extension from the webview.
			anotherUpdateToExt();
		}

	}

	function performUndoEventFormat (cancel = 'not') {
			
			//cancel is set to 'do' when this function is invoked from applyFormat
			if (cancel === 'do'){
				return;
			} else {  // cancel === 'not'
				// Obtain the last object from the stack
				const fromStack = undoStack[undoStack.length - 1];
		
				// grab element from DOM
				const fromDOM = document.getElementById(fromStack.id);
		
				// update the DOM
				fromDOM.outerHTML = fromStack.blobHTML;
	
				// Call restoreCursor to which function we pass the grabbed DOM element as div
				restoreCursor(fromStack);
			}

		}

	// Restore the cursor position
	function restoreCursor(fromStack) {
			console.log("last blob from stack ", fromStack.blobHTML);
	
			cursorState = fromStack.cursor;
			console.log("mycursorState", cursorState);
	
			const range = document.createRange();
			const selection = window.getSelection(); 


			const mydiv = document.getElementById(fromStack.id);
			const grabbedDOM = mydiv.firstChild;

			const children = mydiv.childNodes;
			console.log('children', children);

			const selectedChild = children[cursorState.nodeIndex];
			// newParent = document.createElement('div');
			// range.selectNode(document.getElementById(objFromStack.id));
			
			// // Set the start and end of the range to the desired offset

			range.setStart(selectedChild, cursorState.startOffset);
			range.setEnd(selectedChild, cursorState.endOffset);

			console.log('grabbedDOM ', grabbedDOM);
			console.log('range is ', range);
			// Clear any existing selection and apply the new range
			// const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange(range);
			// range.surroundContents(newParent);
	}

	function placeCursorAtEnd(el) {
			el.focus();
			const range = document.createRange();
			range.selectNodeContents(el);
			range.collapse(false);
			const sel = window.getSelection();
			sel.removeAllRanges();
			sel.addRange(range);
		}

	function performUndoEventTextChange () {
		console.log('From undostack ', undoStack);
			if (!undoStack[0]) { 
				return; 
			};
			let grabbedInnerDivByIdFromDOM = document.getElementById(undoStack[undoStack.length - 1].id);
			console.log('from DOM performUndoEventTextChange ', grabbedInnerDivByIdFromDOM);
			console.log('From blobHTML performUndoEventTextChange ', undoStack[undoStack.length - 1].blobHTML);

			grabbedInnerDivByIdFromDOM.outerHTML = undoStack[undoStack.length - 1].blobHTML;
		}

		// The following eventListener is to be fired when then page has totally loaded.  The message will be 
		// used in the extension in order to trigger the initial population of the webview by the data structure.
        window.addEventListener('load', () => {
            vscode.postMessage({
                type: 'webViewReady',
                text: 'Webview is loaded and ready to receive content.'
            });
        });		

}());