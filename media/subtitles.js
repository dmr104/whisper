
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

	//The following is to regulate the first ever which: previous to set the ball rolling.  It is necessary 
	// because to the logic surrounding singletonVarOnMouseUp
    let firstTimeThroughSingleton = true;
	
	// The following records which div was last formatted.  Is used in conjunction with which: "succession"
	// to determine whether to omit the div with which: "previous"
	let lastDivFormatted;

	// Likewise the following is to record as a global state the last record of what the last formatted which: was equal to
	let lastWhichParentDiv;

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
		// Get the element where the cursor is located
		const selection = window.getSelection();

		if (!selection.rangeCount) {
			return;
		}
		const range = selection.getRangeAt(0);

		let parentDiv = range.commonAncestorContainer;
		// Traverse up to find the nearest div
		while (parentDiv && parentDiv.nodeType !== Node.ELEMENT_NODE) {
			parentDiv = parentDiv.parentNode;
		}

		// The following is to incorporate the logic we have already set up to establish what happens on mouseup first time through.
		if (firstTimeThroughSingleton) {
			undoStack.push({id: parentDiv.id, which: "previous", blobHTML: parentDiv.outerHTML});
			firstTimeThroughSingleton = false;
			lastDivFormatted = Number(parentDiv.id);
			lastWhichParentDiv = "previous";		
		} else {
			console.log('lastDivFormatted', lastDivFormatted);
			console.log('Number(parentDiv.id)', Number(parentDiv.id));
			console.log('which is ', lastWhichParentDiv);

			// Check whether the parent is a div and get its ID.  And only do the following if the last id doesn't match 
			// the present one and the last which: succession.  This is to ensure that which: previous will match if the ids do 
			if (parentDiv && parentDiv.id && (lastDivFormatted !== Number(parentDiv.id)) && (lastWhichParentDiv === "succession")) {			
				// Make sure we record this change in order to give the possibility of reversing it.
				undoStack.push({id: parentDiv.id, which: "previous", blobHTML: parentDiv.outerHTML});
			}
		}
 
		if (lastDivFormatted !== Number(parentDiv.id)) {
			lastDivFormatted = Number(parentDiv.id);
		}

		if (lastWhichParentDiv === "previous") {
			lastWhichParentDiv = "succession";
		}

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

		if (range && range.commonAncestorContainer){
			// Make sure we record this change in order to give the possibility of reversing it.
			undoStack.push({id: range.commonAncestorContainer.id, which: "succession", blobHTML: range.commonAncestorContainer.outerHTML});
		}	

		console.log('Last on undostack is ', undoStack[undoStack.length - 1]);
		console.log('wrapper is', wrapper);
		console.log('range is ', range);
		

		console.log('range commonancestor is ', range.commonAncestorContainer);
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


	const processOnMouseUp = function(event) {

		// Get the element where the cursor is located
		const target = event.target;
		
		// This following is to ensure we have an initial record in the array prior to when we first click into a selection.
		if (!singletonVarOnMouseUp){
			undoStack.push({ 
				id: target.id, 
				blobHTML: target.outerHTML 
			});

			singletonVarOnMouseUp = true;
		} else {
			// If this is the first time you enter the present box, and the previous box has been changed by user input, do this.
			// (The subsequent times you enter the present box won't affect anything, even if the present box becomes changed.)
			if (target.id !== singletonVarBoxEntered && boxIsChanged) {
				// Set the present box
				const _aSegment = {
					id: target.id, 
					blobHTML: target.outerHTML
				};
				// Here we make the global copy as aSegment an immutable copy of _aSegment
				aSegment = { ... _aSegment };
				// Here we cause an immutable copy of the present box to be stored upon the undoStack array
				undoStack.push({ ... _aSegment});
				// Now record that fact that the present box is unchanged.
				boxIsChanged = false;
			} 
		}
		
		// Update singletonVarBoxEntered to ensure that subsequent clicks on the same box won't change anything until a 
		// different box is clicked on.  singletonVarBoxEntered is a global variable
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
			if (lastOnStack.selection instanceof Selection ) {
				if (topOfStack) {
					// Fires on time on each first time of pop.  Logic is for smooth user 
					// experience depending upon where they left off when undo was pressed

					// the last on stack was from a text alteration
					console.log('A b/it/u alteration');
					if (boxIsChanged) {
						console.log("BOX IS CHANGED");
						performUndoEventFormat();
					} else {
						undoStack.pop();
						console.log('From else');
						performUndoEventFormat();
					}
				} 		

			} else { 
				// if the last on stack is from a text alteration change
				if (topOfStack) {
					// Fires on time on each first time of pop.  Logic is for smooth user 
					// experience depending upon where they left off when undo was pressed
					console.log('A text alteration ');
					if (boxIsChanged) {
						console.log("BOX IS CHANGED");
						performUndoEventTextChange();
					} else {
						undoStack.pop();
						performUndoEventTextChange();
					}
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
			let grabbedInnerDivByIdFromUndoStack = document.getElementById(undoStack[undoStack.length - 1].id);
			console.log('from DOM performUndoEventFormat ', grabbedInnerDivByIdFromUndoStack);
			console.log('From blobHTML performUndoEventFormat ', undoStack[undoStack.length - 1].blobHTML);
			

			grabbedInnerDivByIdFromUndoStack.outerHTML = undoStack[undoStack.length - 1].blobHTML;
			// Place cursor at the end
			// placeCursorAtEnd(splurgeContainer);
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
			let grabbedInnerDivByIdFromUndoStack = document.getElementById(undoStack[undoStack.length - 1].id);
			console.log('from DOM performUndoEventTextChange ', grabbedInnerDivByIdFromUndoStack);
			console.log('From blobHTML performUndoEventTextChange ', undoStack[undoStack.length - 1].blobHTML);

			grabbedInnerDivByIdFromUndoStack.outerHTML = undoStack[undoStack.length - 1].blobHTML;
		}

}());