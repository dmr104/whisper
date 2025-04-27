
// Script run within the webview itself.
(function () {

	// Get a reference to the VS Code webview api.
	// We use this API to post messages back to our extension.
	const vscode = acquireVsCodeApi();
	// The undoStack will enable the user to reverse the changes to editing.
	const undoStack = [];

	// The following boolean is used to determine whether the last change to undoStack was a push or a pop.
	// false is a pop, push is a true.  This will determine 
	let topOfStack= false;

	// The following is a global variable of an instance like { id: 3, blobHTML: '<div>text</div'}
	let aSegment = {};

	// The following variable is for if we select a div we are currently within.
	// This eventListener will push onto the stack every time we click on a different div.
	let singletonVarBoxEntered;

	// This following variable is to ensure that the first time we click on the first box, the initial
	// div that gets written to the undoStack will only be written once, and initially.
	let singletonVarOnMouseUp = false;
	// To determine whether the text within a box has been altered;
	let boxIsChanged = false;

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


	// Add event listener for mouseup to detect cursor location
	splurgeContainer.addEventListener('mouseup', e => {
		processOnMouseUp(e);
	});

	splurgeContainer.addEventListener('keyup', e => {
		boxIsChanged = true;
	});

	function applyFormat(type) {
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
		undoStack.push({id: aSegment.id, blobHTML: selection});
		console.log('Last on undostack is ', undoStack[undoStack.length - 1]);
		console.log('wrapper is', wrapper);
		console.log('range is ', range);
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


	// This function is to ensure we have an initial record in the array prior to when we first click into a selection.
	function invokeFirstSegmentRecord(obj){
		let grabbedInnerDivById = document.getElementById('0');
		undoStack.push({ 
			id: obj.id, 
			blobHTML: obj.blobHTML 
		});
	}

	const processOnMouseUp = function(event) {

		// Get the element where the cursor is located
		const target = event.target;

		if (!singletonVarOnMouseUp){
			invokeFirstSegmentRecord({
				id: target.id, 
				blobHTML: target.outerHTML
				});
			singletonVarOnMouseUp = true;
		}

		// If this is the first time you enter the box, and the previous box has been changed by user input, 
		// and the present box has class="segment"
		if (target.id !== singletonVarBoxEntered && boxIsChanged && target.classList.contains('segment')) {
			// Set the present box to unchanged
			boxIsChanged = false;
			const _aSegment = {
				id: target.id, 
				blobHTML: target.outerHTML
				};
			// Here we make the copy as aSegment an immutable copy of _aSegment
			aSegment = { ... _aSegment };
			// Here again we cause an immutable copy to be stored in the undoStack array
			undoStack.push({ ... _aSegment});
			console.log(undoStack);
		} 
		
		// Update singletonVarBoxEntered to ensure that subsequent clicks on the same box won't change anything until a 
		// different box is clicked on.
		singletonVarBoxEntered = target.id;	

		//  Here we set topOfStack=true every time we add something to it.  See processOnUndoButton for use of this variable
		if (!topOfStack){
			topOfStack = true;
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
	

	function applyChangeButton (){
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
		const lastOnStack = undoStack[undoStack.length - 1];
		console.log(undoStack);
		if (undoStack.length>0){
			// if the last on stack is from a formatting change
			if (topOfStack) {
				// Fires on time on each first time of pop.  Logic is for smooth user 
				// experience depending upon where they left off when undo was pressed
				console.log('FIDDLESTICKS');
				if (boxIsChanged) {
					console.log("BOX IS CHANGED");
					performUndoEventTextChange();
				} else {
					undoStack.pop();
					performUndoEventTextChange();
				}

			} else {
				if (lastOnStack.blobHTML instanceof Selection ) {
					// the last on stack was from a text alteration
					console.log('A b/it/u alteration');
					performUndoEventFormat();
				} else { 
					console.log('A text change');
					performUndoEventTextChange();	
				}		
			}
		}

		undoStack.pop();
		topOfStack = false;

		// When stack is empty, reset the flag which controls its initial population
		if (undoStack.length === 0) {
			singletonVarOnMouseUp = false;
		}
	}

	function performUndoEventFormat () {
		console.log('undostack is ', undoStack);
			let grabbedInnerDivById = document.getElementById(undoStack[undoStack.length - 1].id);
			console.log('from DOM', grabbedInnerDivById);
			console.log('From blobHTML ', grabbedInnerDivById);
			

			grabbedInnerDivById = undoStack[undoStack.length - 1].blobHTML;
			// Place cursor at the end
			placeCursorAtEnd(splurgeContainer);
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
			let grabbedInnerDivById = document.getElementById(undoStack[undoStack.length - 1].id);
			console.log('from DOM ', grabbedInnerDivById);
			console.log('From blobHTML ', undoStack[undoStack.length - 1].blobHTML);

			grabbedInnerDivById.outerHTML = undoStack[undoStack.length - 1].blobHTML;
		}

}());