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
	let clickDivId = JSON.parse(localStorage.getItem('clickDivId')) || undefined;

	// The following stores the outerhtml of a text element.  used on mousedown.
	let mygrabbedFromDom;

	// the following flag is used to control the logic of the change style button press
	let changedView=false;
	
	let splurgeContainer;
	
	// The following eventListener is to be fired when the DOMContent of the page has loaded.  The message will be 
	// used in the extension in order to trigger the initial population of the webview by the data structure.
	window.addEventListener('DOMContentLoaded', () => {			
		vscode.postMessage({
			type: 'webviewReady',
			text: 'Webview is loaded and ready to receive content.'
		});


		// The following is used in the function addSegmentToSplurge
		splurgeContainer = document.getElementById('splurge');
	
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
	
		// Listener for messages from the extension. This function responds ultimately to the keybindings.  Note 
		// that we simulate a click event within processButtonClick.  Goes  
		// (keybinding with command.name) -> (args.command) -> (simulate button press in toolbar)
		window.addEventListener('message', event => {
			const message = event.data;
			if (message.command){
				processButtonClick(message.command);
			}
		});
	
		window.addEventListener ('message', event => { 
			const message = event.data;
			if (message.segment){
				addSegmentToSplurge(message.segment, message.id);
			}
		});
	
		window.addEventListener ('message', event => { 
			const message = event.data;
			if (message.getDataFromDOM === 'grabWholeSplurgeFromWebview'){
				const currentSplurgeElement = document.getElementById('splurge');
				if (currentSplurgeElement) {
						vscode.postMessage({ type: 'gotWholeSplurgeFromDOM', data: currentSplurgeElement.innerHTML});
					} else {
						console.log('Splurge element not found at the time of event.');
				}
			}
		});

		window.addEventListener('message', event => {
			const message = event.data;
			if (message.postDataFromExtension === 'grabbedWholeSplurge') {
				let myGrabbedSplurge = document.getElementById('splurge');

				// populate the splurge from the extension to the webview
				myGrabbedSplurge.innerHTML = message.data;
			}
		});
		
		// The following is for receipt to the broadcast done to the webviews
		window.addEventListener('message', event => {
			const message = event.data;
			if (message.receivedBroadcast === 'broadcastReceivedByWebviews'){
				const splurgified = document.getElementById(message.segmentId);
			
				// populate the segment from the extension to the webview
				splurgified.innerHTML = message.segmentHTML;
			}
		});

		splurgeContainer.addEventListener('input', (e) => {
			processInput(e);
	
			// Make sure we send an update to the extension from the webView every time a key is input.
			updateToExt(e);
		});
		
		splurgeContainer.addEventListener('mousedown', (e) => {
			processMouseClick(e);
		});

	});	
	

	function updateToExt(event){
		target = event.target;
		myID = target.id;
	
		myTextContentHTML = target.innerHTML;

		// The following is to update the extension from the webview each time a key is pressed.
		processUpdateToExt(myID, myTextContentHTML);
	}

	function processUpdateToExt(myID, myHTML) {
		vscode.postMessage({ 
			type: 'updateText',
			id: myID,
			segmentHTML: myHTML 
		});
		vscode.postMessage({
			type: 'sendToWebviewView',
			segmentHTML: myHTML
		});
	}

	function anotherUpdateToExt () {			
		// The following is to grab the modified div in order to update the extension from the webView each 
		// time a formatting occurs (bold, italics, underline).

		// Set the innerHTML of a variable to the provided outerHTML from a global variable.
		let tempDiv = document.createElement('div');
		tempDiv.innerHTML = mygrabbedFromDom;
		let myStoredDiv = tempDiv.firstElementChild;

		const divID = myStoredDiv.id;
		let afterStoredDiv = document.getElementById(divID);
		// We pass two fields of information from the webview to the extension.
		const myID = afterStoredDiv.id;
		const divInnerHTML = afterStoredDiv.innerHTML;

		processUpdateToExt(myID, divInnerHTML);

	}

	function applyFormat(type) {
		// We store this div from the DOM in case we click a formatting button 
		// with the text highlighted within a previously formatted bit
		let storeThisDiv = document.getElementById(clickDivId);
		const theStoredDiv = storeThisDiv.outerHTML;

		// Get the element where the cursor is located
		const selection = window.getSelection();
		console.log('selection is', selection);

		if (!selection.rangeCount) {
			return;
		}

		let ranges = [];

		sel = window.getSelection();

		for (let i = 0; i < sel.rangeCount; i++) {
		ranges[i] = sel.getRangeAt(i);
		}
		/* Each item in the ranges array is now a range object representing one of the ranges in the current selection */

		console.log('ranges array is ', ranges);

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

		const range = selection.getRangeAt(0);
		console.log('range is', range);
	
		let myText = range.startContainer;

		console.log('myText', myText);

		console.log('myText is', myText.nodeValue);

		let myParentElement;
   		// If it's a text node, get its parent
        if (myText.nodeType === Node.TEXT_NODE) {
            myParentElement = myText.parentElement;
        } else if (myText.nodeType === Node.ELEMENT_NODE) {
   		 myParentElement = myText; // If the common ancestor is an element, use it directly
		}

		console.log('myParentElement.nodeName is ', myParentElement.nodeName);
		console.log('myParentElement.nodeType is ', myParentElement.nodeType);
		
		if (myParentElement.nodeType === Node.ELEMENT_NODE && 
			( 	myParentElement.nodeName === 'STRONG' || 
				myParentElement.nodeName === 'U' || 
				myParentElement.nodeName === 'EM'	)) {
			const regexp = /<(strong|em|u)>(.*?)<\/\1>/;
			const originalHTML = myParentElement.outerHTML;
			const result = originalHTML.match(regexp);
			let myTag, cleanedText;
			if (result){
				const [tag, text] = result.slice(1);
				myTag = tag;
				cleanedText = text;
			}
			console.log('cleaned text', cleanedText);

			if (tag === myTag){
				console.log('YAY.  SUCCESS');
				myParentElement.outerHTML = cleanedText;
				// Replace the selected contents
			} else {
				const newElement = document.createElement(tag);
				newElement.innerHTML = cleanedText;
				console.log('My new Element', newElement);
				myParentElement.outerHTML = newElement.outerHTML;
			};
			range.deleteContents();
			range.selectNodeContents(myParentElement);
			// Move cursor after the inserted node
			range.setStartBefore(myText);
			range.setEndAfter(myText);
			// // Update selection
			selection.removeAllRanges();
			console.log('new range ', range);
			// selection.addRange(range);
			console.log("HURRAH!", originalHTML, 'cleanedText', cleanedText, 'myTag', myTag, 'myParentElement', myParentElement);
			anotherUpdateToExt();
			return;
		}


		// Store the start and end positions.  It is important to realise that we grab a node from the parent using
		// parent.childNodes[i], but first we need to obtain the parent from where the cursor was located.
		// The following produces the actual text of the node.  use .parent to obtain the parent.
		const startContainer = range.startContainer;
		const startOffset = range.startOffset;
		const endContainer = range.endContainer;
		const endOffset = range.endOffset;

		const selectedText = range.toString();

		console.log('selectedText is ', selectedText);
	
		if (selectedText.length === 0) {
			return;
		}


		const wrapper = document.createElement(tag);
		wrapper.textContent = selectedText;

        // Replace the selected contents
		range.deleteContents();
		range.insertNode(wrapper);
	
		// Move cursor after the inserted node
		range.setStartAfter(wrapper);
		range.setEndAfter(wrapper);
		// Update selection
		selection.removeAllRanges();
		selection.addRange(range);

		// Get the common ancestor
		// The following is to find the div containing where the mouse was clicked.  
		// This is done in order to decide whether the commonancestor has an id, if 
		// it does then we are within a div not a strong, italic, or underline
		const commonAncestor = range.commonAncestorContainer;

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
		// console.log('Text node index in common ancestor children:', index);


		// Store the initial cursor position
		const cursorState = {
			startContainer: startContainer,
			startOffset: startOffset,
			endContainer: endContainer,
			endOffset: endOffset,
			nodeIndex: index
		};		
		
		// console.log('cursorState', cursorState);

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

		// console.log('Last on undostack is ', undoStack[undoStack.length - 1]);
		// console.log('range is ', range);
		
		// console.log('selection is ', selection);
		// console.log(undoStack);

	}


	const processButtonClick = function(args) {
		// message.command is the args object from package.json

			let useThisButtonId = '';
			switch(args) {
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
		// Here we store this global variable to persist it in the webview 
		localStorage.setItem('clickDivId', JSON.stringify(clickDivId));
		let grabbedFromDom = document.getElementById(clickDivId);
		mygrabbedFromDom = grabbedFromDom.outerHTML;
		// clickDivId and storedDivId are globally scoped

		// console.log('storedDivId is ', storedDivId);
		// console.log('clickDivId is ', clickDivId);
		// console.log('target is ', target);		

	};

	const processInput = function (event) {
		
		const target = event.target;
		const inputDivId= target.id;

		if (storedDivId === null) { // No ID is currently stored

			undoStack.push({
				id: target.id,
				blobHTML: mygrabbedFromDom});
		
			storedDivId = inputDivId;

		} else { // An ID is already stored
				
			if (storedDivId !== inputDivId) {  // No match. Have moved to another box.	
				undoStack.push({
					id: target.id,
					blobHTML: mygrabbedFromDom});
					
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
		segment.innerHTML = mytext;
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
		grabbedButton.textContent='Toggle';
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

					// console.log('A b/it/u alteration');
					performUndoEventFormat();

			} else { 
				// if the last on stack is from a text alteration change

					// console.log('A text alteration ');					
					performUndoEventTextChange();
				}
			undoStack.pop();

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
			// console.log("last blob from stack ", fromStack.blobHTML);
	
			cursorState = fromStack.cursor;
			// console.log("mycursorState", cursorState);
	
			const range = document.createRange();
			const selection = window.getSelection(); 


			const mydiv = document.getElementById(fromStack.id);

			const children = mydiv.childNodes;
			// console.log('children', children);

			const selectedChild = children[cursorState.nodeIndex];
			
			// // Set the start and end of the range to the desired offset

			// range.setStart(selectedChild, cursorState.startOffset);
			// range.setEnd(selectedChild, cursorState.endOffset);

			// Was changed to the following to avoid a console.log error upon mix and matching the undo button with manual unbold, etc. 

			range.setStartBefore(selectedChild);
			range.setEndAfter(selectedChild);

			console.log('range is ', range);
			// Clear any existing selection and apply the new range
			// const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange(range);
		
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

			let mydiv = undefined; 
			if (undoStack.length > 0){
				mydiv = document.getElementById(undoStack[undoStack.length - 1].id);
			}
			if (mydiv){
				mydiv.focus();
			}
			
		}

	

}());
