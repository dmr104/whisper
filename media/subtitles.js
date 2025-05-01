
// Script run within the webview itself.
(function () {

	class ImmutableQueue {
		constructor() {
			this.queue = [];
		}
	
		// Enqueue an immutable object
		enqueue(obj) {
			const immutableObj = Object.freeze({ ...obj });
			this.queue.push(immutableObj);
		}
	
		// Dequeue an object
		dequeue() {
			if (this.isEmpty()) {
				return null; // or throw an error
			}
			return this.queue.shift();
		}
	
		// Check if the queue is empty
		isEmpty() {
			return this.queue.length === 0;
		}
	
		// View the front object without removing it
		peek() {
			if (this.isEmpty()) {
				return null; // or throw an error
			}
			return this.queue[0];
		}
	}

	const fifoQueue = new ImmutableQueue();

	// Get a reference to the VS Code webview api.
	// We use this API to post messages back to our extension.
	const vscode = acquireVsCodeApi();
	// The undoStack will enable the user to reverse the changes to editing.
	const undoStack = [];

	// The following variable is for if we select a div we are currently within via an input.
	let storedDivId = null;

	// The following stores the 
	let grabbedFromDom;

	// The following stores the outerhtml of a text element.  used on mousedown.
	let mygrabbedFromDom;

	// the following flag is used to control the logic of the change style button press
	let changedView=false;	

	// The following is used in the function addSegmentToSplurge
	const splurgeContainer = document.getElementById('splurge');

	document.getElementById("boldBtn").addEventListener("click", () => applyFormat("bold"));
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
	});

	
	splurgeContainer.addEventListener('mousedown', (e) => {
		processMouseClick(e);
	});

	function applyFormat(type) {

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

		// The following is to find the div containing the cursor.  It will change
		let parentDiv = range.commonAncestorContainer;

		// Traverse up to find the nearest div
		while (parentDiv && parentDiv.nodeType !== Node.ELEMENT_NODE) {
			parentDiv = parentDiv.parentNode;
		} 

		// Get the common ancestor
		const commonAncestor = range.commonAncestorContainer;
		console.log('commonAncestor is', commonAncestor);
		// Traverse up to find the nearest div
	
		const children = commonAncestor.childNodes;

		// Find the index of the text node
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

		if (parentDiv && parentDiv.id) {			
			// Make sure we record this change in order to give the possibility of reversing it.
			undoStack.push({
				id: parentDiv.id, 
				cursor: cursorState, 
				blobHTML: mygrabbedFromDom});
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
		target = event.target;
		const clickDivId = target.id;

		if (undoStack.length === 0) { // stack is empty
			undoStack.push({ 
			id: target.id, 
			blobHTML: target.outerHTML 
			});
			storedDivId = clickDivId;
		}

		// The following two variables are globally scoped
		grabbedFromDom = document.getElementById(clickDivId);
		mygrabbedFromDom = grabbedFromDom.outerHTML;
		console.log('storedDivId is ', storedDivId);

	};

	const processInput = function (event) {
        
		const target = event.target;
		const inputDivId= target.id;

		if (storedDivId === null) { // No ID is currently stored
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
		if (undoStack.length>0){
			const lastOnStack = undoStack[undoStack.length - 1];
			// Logic is for smooth user experience depending upon where they left off when undo was pressed
			if ('cursor' in lastOnStack) {	
					// the last on stack was from a text alteration

					console.log('A b/it/u alteration');
					performUndoEventFormat();

			} else { 
				// if the last on stack is from a text alteration change

					console.log('A text alteration ');					
					performUndoEventTextChange();
				}
			undoStack.pop();
			console.log('donkeys', undoStack);
		}

	}

	function performUndoEventFormat () {
			
			// Obtain the last object from the stack
			const fromStack = undoStack[undoStack.length - 1];
	
			// grab element from DOM
			const fromDOM = document.getElementById(fromStack.id);
	
			// update the DOM
			fromDOM.outerHTML = fromStack.blobHTML;

			// Call restoreCursor to which function we pass the grabbed DOM element as div
			restoreCursor(fromStack);
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

}());