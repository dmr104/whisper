// Script run within the webview itself.
(function () {

	// Get a reference to the VS Code webview api.
	// We use this API to post messages back to our extension.
	const vscode = acquireVsCodeApi();
	// The undoStack will enable the user to reverse the changes to editing.
	const undoStack = [];
	let theLastKnownEventToHaveOccurredUponTheUndoStack = { wasAnIncrement: true };

	// The following variable is for if we select a div we are currently within via an input.
	let globalStoredDivIdOfBlob = null;

	// The following is used to pass the event.target.id of where the mouse is clicked to applyFormat
	let globalClickBlobId = JSON.parse(localStorage.getItem('globalClickBlobId')) || undefined;

	// The following stores the outerhtml of a text element.  used upon the function as processMouseClick(), 
	// and the function as updateToExtUponFormattingChange().  To be relegated and replaced by globalLastGrabbedBlobFromDOM
	let globalGrabbedBlobFromDOM = document.createElement('div');
	globalGrabbedBlobFromDOM.setAttribute('class', 'segment');
	globalGrabbedBlobFromDOM.setAttribute('contenteditable', 'true');
    globalGrabbedBlobFromDOM.setAttribute('id', 'null');
	
	let globalLastGrabbedBlobFromDOM = { id: null, innerHTML: "", textContent: "" };

	// The following is a peek-ahead to be used within processOnUndoButton() so that we can work with the last 
	// remaining item on the stack if the undo button is ever pressed repeatedly until it gets there.
	let	globalLocalCachedUndoStackIsEmptiedBlob;
	
	// the following flag is used to control the logic of the change style button press
	let changedView=false;
	
	let splurgeContainer;

	splurgeContainer = document.getElementById('splurge');

	// The following eventListener is to be fired when the DOMContent of the page has loaded.  The message will be 
	// used in the extension in order to trigger the initial population of the webview by the data structure.
	window.addEventListener('DOMContentLoaded', () => {			
		vscode.postMessage({
			type: 'webviewReady',
			text: 'Webview is loaded and ready to receive content.'
		});
	
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
		
		// Scrubber button
		document.getElementById("scrubberBtn").addEventListener("click", () => scrubTheBlob());
	
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
				//console.log('myText to addSegmentToSplurge from message.segment is :', message.segment);
				//console.log('id to addSegmentToSplurge from message.segment is :', message.id);
				addSegmentToSplurge(message.segment, message.id	);
			}
		});

		window.addEventListener ('message', event => { 
			const message = event.data;
			if (message.segmentFromJson){
				//console.log('myText to addSegmentToSplurge from message.segmentFromJson is :', message.segmentFromJson);
				//console.log('id to addSegmentToSplurge from message.segmentFromJson is :', message.id);
				addSegmentToSplurge(message.segmentFromJson, message.id);
			}
		});		
	
		window.addEventListener ('message', event => { 
			const message = event.data;
			if (message.getDataFromDOM === 'grabWholeSplurgeFromWebview'){
				const currentSplurgeElement = document.getElementById('splurge');
				if (currentSplurgeElement) {
					// Posting from webview to extension after having received the trigger from the extension
						vscode.postMessage({ type: 'gotWholeSplurgeFromDOM', data: currentSplurgeElement.innerHTML});
					} else {
						console.log('Splurge element not found at the time of event.');
				}
			}
			// The following replication is necessary so that when a webview is closed we don't receive instructions or 
			// data from the export to all file formats command.  We require two data splurges for two separate chain of 
			// instructions
			if (message.getDataFromDOM === 'anotherGrabWholeSplurgeFromWebview'){
				const currentSplurgeElement = document.getElementById('splurge');
				if (currentSplurgeElement) {
						vscode.postMessage({ type: 'anotherGotWholeSplurgeFromDOM', data: currentSplurgeElement.innerHTML});
					} else {
						console.log('Splurge element not found at the time of event.');
				}
			}
		});

		window.addEventListener('message', event => {
			// We are now in the process of broadcasting from one webview to many via the extension middleman
			const message = event.data;
			if (message.postDataFromExtension === 'grabbedWholeSplurge') {
				let myGrabbedSplurge = document.getElementById('splurge');
				if (myGrabbedSplurge) {
					console.log('myGrabbedSplurge from postDataFromExtension eventListener', myGrabbedSplurge);
					// populate the splurge from the extension to the webview
					myGrabbedSplurge.innerHTML = message.data;
				}
			}
		});
		
		// The following is for receipt to the broadcast done to the webviews
		window.addEventListener('message', event => {
			const message = event.data;
			// console.log('FROM EVENTLISTENER for broadcast done to webview event.data: ', message);
			if (message.receivedBroadcast === 'broadcastReceivedByWebviews'){
				let splurgified = document.getElementById(message.segmentId);
				if (splurgified) {
					// populate the segment from the extension to the webview
					splurgified.innerHTML = message.segmentHTML;
				}
			}
		});

		// The following event listener fires whenever a keyboard key is pressed.
		splurgeContainer.addEventListener('input', (e) => {
			if (e.target.className = "segment") {
				console.log('From input event Listener: ', e);
			}
			processInput(e);
			//e.stopPropagation();
			// Make sure we send an update to the extension from the webView every time a key is input.
			updateToExtUponKeyPress(e);
			
		});
		
		splurgeContainer.addEventListener('click', (event) => {
			if (event.target.id !== "splurge" && event.target.className === "segment") {
				console.log("we have successfully gotten a segment from single click");
				processMouseClick(event);
				// event.stopPropagation();
			}
		});

		splurgeContainer.addEventListener('dblclick', (e) => {
				if (e.target.className = "segment") {
					console.log("we have successfully gotten a segment from dblclick");
				}	
				//e.stopPropagation();
		});
		
	});	
	

	function updateToExtUponKeyPress(event){
		target = event.target;
		myID = target.id;
	
		const myTextContentHTML = target.innerHTML;

		// The following is to update the extension from the webview each time a key is pressed.
		vscode.postMessage({ 
			type: 'updateText',
			id: myID,
			segmentHTML: myTextContentHTML 
		});
		vscode.postMessage({
			type: 'sendToWebviewView',
			segmentHTML: myTextContentHTML
		});
	}

	function updateToExtUponFormattingChange (myBlobObj, liveBlobDOMElement) {			
		// The following is to process the unmodified myBlobObj AND the modified liveBlobDOMElement
		// in order to update the extension from the webView each time a formatting occurs 
		// (bold, italics, underline).

		// Set the innerHTML of a variable to the provided outerHTML from a global variable.
		console.log('myBlobObj within updateToExtUponFormattingChange is:', myBlobObj);
		console.log('liveBlobDOMElement within updateToExtUponFormattingChange is:', liveBlobDOMElement);

		//let tempDiv = document.createElement('div');
		//tempDiv.outerHTML = globalGrabbedBlobFromDOM.outerHTML;
		// let myStoredDiv = tempDiv.firstElementChild;

		//const divID = myStoredDiv.id;
//		let afterStoredDiv = document.getElementById(divID);
		// We pass two fields of information from the webview to the extension.

		if (myBlobObj.id) {
				vscode.postMessage({ 
				type: 'updateText',
				id: liveBlobDOMElement.id,
				segmentHTML: liveBlobDOMElement.innerHTML 
			});
			vscode.postMessage({
				type: 'sendToWebviewView',
				segmentHTML: liveBlobDOMElement.innerHTML
			});
		}

	}

	function applyFormat(type) {
		
		console.log('undoStack from start of applyFormat ', undoStack);
		//let storedBlobFromGlobalClick = document.getElementById(globalClickBlobId);
		//console.log('clickDiv id is: ', globalClickBlobId);
		//console.log('storedBlobFromGlobalClick from applyFormat is:', storedBlobFromGlobalClick);
		//console.log('storedBlobFromGlobalClick.childNodes from applyFormat is:', storedBlobFromGlobalClick.childNodes);
		
		// Get the element where the cursor is located
		const selection = document.getSelection();
		console.log('selection is:', selection);

		if (!selection.rangeCount) {
			return;
		}

		// We encode a store of all the Ranges of a selection within a document for potential future
		// expandability, although this is probably never likely to be utilized.  In practice, we are dealing
		// with one Range only at a time, i.e. to Range object as ranges[0]. 
		let ranges = [];
		ranges[0] = selection.getRangeAt(0);

//		for (let i = 0; i < selection.rangeCount; i++) {
//		}

		/* Each item in the ranges array is now a range object representing one of the ranges in the current selection */

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

		// Select out only Range object with i = 0, as mentioned earlier in the above comment.
		// We use the range object in this function to find out where the user has clicked, and which input
		// blob has been entered. This is a clean way to work and is preferable than storing everything in a 
		// global variable, which, incidentally,the variable as globalClickBlobId does do. What we really need the 
		// range object for also, is to find out what text the user has highlighted, for cursor (caret) 
		// manipulation, and restoration upon the use to the button as undo. Think of this as a surgeon using a
		// scalpel, in comparison to a tree-surgeon using a chainsaw.  We won't, incidentally, utilize the 
		// variable as globalClickBlobId for manipulating DOM elements because the chainsaw breaks the UI.  That's good
		// to know, isn't it?
		const i = 0;
		console.log('range from applyFormat is', ranges[i]);
		
		const familyOfNodes = ranges[i].commonAncestorContainer.parentNode.childNodes;
		
		console.log('familyOfNodes is:', familyOfNodes);

		// Find the index of the text node within which we highlighted
	
		let index = -1;
		for (let k = 0; k < familyOfNodes.length; k++) {
			if (ranges[i].commonAncestorContainer === familyOfNodes[k] ) {
				index = k;
				break;
			}
		}

		console.log('commonAncestorContainer.parentElement.nodeType is:', ranges[i].commonAncestorContainer.parentElement.nodeType);

		if (!ranges[i].commonAncestorContainer.parentElement.nodeType === Node.ELEMENT_NODE) {return;}
		if (ranges[i].commonAncestorContainer.parentElement.childNodes[index].nodeName === 'STRONG') {return;}
		if (ranges[i].commonAncestorContainer.parentElement.childNodes[index].nodeName === 'U') {return;}
		if (ranges[i].commonAncestorContainer.parentElement.childNodes[index].nodeName === 'EM') {return;}
		
		console.log('the place where you clicked is internally a text node', ranges[i].commonAncestorContainer.parentNode.childNodes[index].nodeType);
		console.log('And its parent is of node_type:', ranges[i].commonAncestorContainer.parentNode.nodeType);
		console.log('THE INDEX is: ', index);
		
		if (ranges[i].commonAncestorContainer.parentNode.childNodes[index].nodeType === Node.TEXT_NODE) {
			const dynamicallyGrabbedBlobID = ranges[i].commonAncestorContainer.parentNode.id;
			const dynamicallyGrabbedBlobHTML = ranges[i].commonAncestorContainer.parentNode.innerHTML;
			const dynamicallyGrabbedBlobLength = ranges[i].startContainer.length;

			// exit the wider function if a selection of text crosses node boundaries, or crosses a <br>
			console.log('selection.getComposedRanges()', selection.getComposedRanges());
			
			if (!selection.getComposedRanges()){ return; };
			
			const gottenNode = ranges[i].commonAncestorContainer.parentNode.childNodes[index];
			//ranges[i].commonAncestorContainer.parentNode.childNodes[index].remove();
			
			let gottenNodeText = gottenNode.textContent;
			
			const tagNode = document.createElement(tag);
			
			//const newBlobElement = document.createElement('div');
			//newBlobElement.setAttribute('class', 'segment');
			//newBlobElement.setAttribute('contenteditable', 'true');
			//newBlobElement.setAttribute('id', dynamicallyGrabbedBlobID);
			//console.log('newBlobElement Before DOM manipulation is:', newBlobElement);
			

			console.log('selection.getRangeAt(0)', selection.getRangeAt(0));
			console.log('ranges[i].commonAncestorContainer.parentNode.childNodes[index] via gottenNode variable is: ', gottenNode);
			
			console.log('my gottenNode derives from: ', ranges[i].commonAncestorContainer.parentNode.childNodes[index]);
			console.log('my gottenNode parent node is: ', ranges[i].commonAncestorContainer.parentNode);
			console.log(' A NEW aPPROaCH is ', ranges[i].commonAncestorContainer.parentNode.children[dynamicallyGrabbedBlobID]); 
			// Store a copy of the ranges's startOffSet and endOffset before the update to the DOM changes everything
			const myStartOffset = ranges[i].startOffset;
			const myEndOffset = ranges[i].endOffset; 
			console.log('from applyFormat BEFORE startContainer, startOffset, endContainer, endOffSet, isConnected', ranges[i].startContainer, ranges[i].startOffset, ranges[i].endContainer, ranges[i].endOffset, ranges[i].startContainer.isConnected);

			const formerString = gottenNodeText.slice(0, ranges[i].startOffset);
			const middleString = gottenNodeText.slice(ranges[i].startOffset, ranges[i].endOffset);
			const latterString = gottenNodeText.slice(ranges[i].endOffset);
			const newTextFormer = document.createTextNode(formerString);
			console.log('tagNode BEFORE textContent after DOM manipulation is:', tagNode);
			tagNode.textContent = middleString;
			console.log('tagNode AFTER textContent after DOM manipulation is:', tagNode);
			const newTextLatter = document.createTextNode(latterString);
			
			// We cannot use `blobHTML: globalGrabbedBlobFromDOM`. So, we use `dynamicallyGrabbedBlobHTML` here, not later, 
			// because we want to record on the undo stack, a record of what the item was, and not what it will have 
			// become after DOM manipulation. Note that once we ought to desist from communicating this value of 
			// `dynamicallyGrabbedBlobHTML` via global variables in favour of subsequent delegated function calls 
			// within applyFormat, passing this data as a parameter to these delegated functions. 
			
			const myObjectToPushToUndoStack = {
				id: dynamicallyGrabbedBlobID, 
				cursor: { 'startOffset': myStartOffset, 'endOffSet': myEndOffset, 'middleNewNodes': index + 1 }, 
				blobHTML: dynamicallyGrabbedBlobHTML,
				length: dynamicallyGrabbedBlobLength
			};
			
			undoStack.push(myObjectToPushToUndoStack);			

			//tagNode.insertAdjacentText( 'afterbegin', middleString);

			//newBlobElement.append(formerString, tagNode, latterString);
			//newBlobElement.append(formerString, tagNode, latterString);

			// ranges[i].commonAncestorContainer.parentNode.children[index].remove();
			// Now we manipulate the DOM
			// const myInnerDivs = splurgeContainer.children;
			//console.log('myInnerDivs :', myInnerDivs);		
			//const myArray = Array.from(myInnerDivs);
			console.log('ranges[i].commonAncestorContainer; from applyFormat :', ranges[i].commonAncestorContainer);
			console.log('ranges[i] from applyFormat :', ranges[i]);
					
			//myArray[globalLastGrabbedBlobFromDOM.id];
			//console.log('myArray :', myArray);
			
			//This one
			//ranges[i].commonAncestorContainer.parentNode.replaceChild(newBlobElement, ranges[i].commonAncestorContainer.parentNode.childNodes[index]);

			ranges[i].commonAncestorContainer.parentNode.childNodes[index].replaceWith(newTextFormer, tagNode, newTextLatter);
			
			console.log('ranges[i].commonAncestorContainer.parentNode.children[dynamicallyGrabbedBlobID].nodeType', ranges[i].commonAncestorContainer.parentNode.children[dynamicallyGrabbedBlobID].nodeType);

			console.log('ranges[i].commonAncestorContainer.parentNode.children[dynamicallyGrabbedBlobID].childNodes', ranges[i].commonAncestorContainer.parentNode.children[dynamicallyGrabbedBlobID].childNodes);

			console.log('splurgeContainer.children[dynamicallyGrabbedBlobID].childNodes', splurgeContainer.children[dynamicallyGrabbedBlobID].childNodes);

			// ranges[i].commonAncestorContainer.parentNode.parentElement.replaceChild(newBlobElement, myArray[globalLastGrabbedBlobFromDOM.id]);		

			// Remember to now store a the value of which DOM has been most recently altered within the global as 
			// theDivMostRecentlyAltered, which will be read by  

			//ranges[i].deleteContents();
			//ranges[i].selectNodeContents(myParentElement);
			// Move cursor after the inserted node
			//ranges[i].setStartBefore(myText);
			//ranges[i].setEndAfter(myText);	

			
			// storedBlobFromGlobalClick.innerHTML = newBlobDiv.innerHTML;
			console.log('from applyFormat AFTER startContainer, startOffset, endContainer, endOffSet, isConnected', ranges[i].startContainer, ranges[i].startOffset, ranges[i].endContainer, ranges[i].endOffset, ranges[i].startContainer.isConnected);

			// console.log('newBlobElement AFTER DOM manipulation is:', newBlobElement);
			

			// wrapper.textContent = ranges[i].startContainer;
			// Replace the selected contents
			//ranges[i].deleteContents();
			//ranges[i].insertNode(wrapper);
			
			// Move cursor after the inserted node
			//ranges[i].setStartAfter(storedBlobFromGlobalClick);
			//ranges[i].setEndAfter(storedBlobFromGlobalClick);
			
			// ranges[i].selectNodeContents(myParentElement);
			// Move cursor after the inserted node
			// ranges[i].setStartBefore(myParentElement);
			// ranges[i].setEndAfter(myParentElement);	
			// Update selection
			
	
			selection.removeAllRanges();
			selection.addRange(ranges[i]);

			if (true) {			
				// Make sure we record this change in order to give the possibility of reversing it.
	
				} else {
					//storedBlobFromGlobalClick.innerHTML = storedBlobFromGlobalClick.outerHTML;
					//console.log("DOES THIS EVER FIRE??????");
					//performUndoEventFormat('do');
			}
				
			// console.log('Last on undostack is ', undoStack[undoStack.length - 1]);
			// console.log('range is ', range);
			
			// console.log('selection is ', selection);
			// Make sure that the update to the DOM is transmitted from webview to extension ever time we 
			// invoke this command.
			console.log('undoStack from end of applyFormat ', undoStack);
			updateToExtUponFormattingChange(myObjectToPushToUndoStack, dynamicallyGrabbedBlobID);
		}
		
		
		
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
			case 'performScrubTheBlob':
				useThisButtonId = 'scrubberBtn';
				break;
			default:
				useThisButtonId = 'defaultBtn';
			}
				document.getElementById(useThisButtonId).click(); // Simulate button click
		
	};

	const processMouseClick = function (event) {	 
		let target = event.target;
		
		const testing = true;
		
		if (testing) {
			let selection = window.getSelection();
			console.log('from process mouse click :', {
				detail: event.detail,
				clickCount: event.detail,
				text: selection.toString(),
				anchorNode: selection.anchorNode,
				anchorOffset: selection.anchorOffset,
				focusNode: selection.focusNode,
				focusOffset: selection.focusOffset,
				rangeCount: selection.rangeCount,
				id: event.target.id
			});

		}

		console.log('PUCKOOWWWWWW!');
        console.log('EVENT in processMouseClick :', event);
		console.log('undoStack from processMouseClick is :', undoStack);

		// move up to the div element with an id on it
		//while (!target.id){
		//	target = target.parentNode;
		//}

		// globalClickBlobId is global, as is globalGrabbedBlobFromDOM which being a string is passed by value.
		// We can use this fact to reconstruct an HTMLELement in the function updatetoExtUponFormattingChange.
		globalClickBlobId = target.id;
		// Here we store this global variable to persist it in the webview 
		localStorage.setItem('globalClickBlobId', JSON.stringify(globalClickBlobId));
		let localGrabbedBlobFromDom = document.getElementById(event.target.id);
		console.log('globalLastGrabbedBlobFromDOM from processMouseClick PRIOR is ', globalLastGrabbedBlobFromDOM);
		console.log('localGrabbedBlobFromDOM from processMouseClick PRIOR is ', localGrabbedBlobFromDom);
		console.log('splurgeContainer from processMouseClick PRIOR is ', splurgeContainer);
		

		// The globalGrabbedBlobFromDOM global varible is used to commmunicate information to the function as 
		// updateToExtUponFormattingChange
		if (localGrabbedBlobFromDom.className === "segment") {
			console.log("SEGMENT YES");
			globalLastGrabbedBlobFromDOM.id = localGrabbedBlobFromDom.id;
			globalLastGrabbedBlobFromDOM.textContent = localGrabbedBlobFromDom.textContent;	
			globalLastGrabbedBlobFromDOM.innerHTML = localGrabbedBlobFromDom.innerHTML;
			globalLastGrabbedBlobFromDOM.length = localGrabbedBlobFromDom.textContent.length;
			
			console.log('globalLastGrabbedBlobFromDOM from processMouseClick AFTER is ', globalLastGrabbedBlobFromDOM);
			console.log('localGrabbedBlobFromDOM from processMouseClick AFTER is ', localGrabbedBlobFromDom);

		}
		// globalClickBlobId and globalStoredDivIdOfBlob are globally scoped
		console.log('splurgeContainer from processMouseClick AFTER is ', splurgeContainer);


		// console.log('globalClickBlobId is ', globalClickBlobId);
		// console.log('target is ', target);
	};


		// The function as processInput is fired whenever a key is pressed on the keyboard
		processInput = function (event) {
			const localInputDivIdOfBlob = event.target.id;
			const eventTargetInnerHTML = event.target.innerHTML;
			console.log('Caught in a trap, from processInput eventTarget:', event.target);
			console.log('Caught in a trap, from processInput eventTargetInnerHTML :', eventTargetInnerHTML);
			console.log('Caught in a trap, from processInput globalLastGrabbedBlobFromDOM :', globalLastGrabbedBlobFromDOM); 
			console.log('Caught in a trap, from processInput undoStack is ', undoStack);
			
			let myLocalGrabbedBlobFromDom = document.getElementById(localInputDivIdOfBlob);
			console.log("Caught in a trap, from processInput myLocalGrabbedBlobFromDom :", myLocalGrabbedBlobFromDom);
			console.log('event from processInput is :', event); 
			console.log("Caught in a trap, from processInput lastGrabbedBlobFromDom.innerHTML.length :", globalLastGrabbedBlobFromDOM.innerHTML.length); 
			console.log("Caught in a trap, from processInput lastGrabbedBlobFromDom.textContent.length :", globalLastGrabbedBlobFromDOM.innerHTML.length); 
			
			// If we are the cursor is not within a blob 
			// was testing upon !globalStoredDivIdOfBlob
			//if (!localInputDivIdOfBlob) { // No ID is currently found from local blob
			//	return;
			//}
					
			// globalGrabbedBlobFromDOM will always track the segment location which has been clicked within: 
			// see `processMouseClick()`.
			// The following occurs if the first text change occurs upon a virgin undoStack.  
			if (undoStack.length === 0 && theLastKnownEventToHaveOccurredUponTheUndoStack.wasAnIncrement === true) {
				undoStack.push({
					id: globalLastGrabbedBlobFromDOM.id,
					blobHTML: globalLastGrabbedBlobFromDOM.innerHTML,
					textContent: globalLastGrabbedBlobFromDOM.textContent,
					length: globalLastGrabbedBlobFromDOM.textContent.length
				});	
				globalStoredDivIdOfBlob = localInputDivIdOfBlob;
				// We will need `theLastKnownEventToHaveOccurredUponTheUndoStack.wasAnIncrement` to determine what happened last time 
				// when undoing text within processOnUndoButton(). If so then this is a re-occurence.  The default value applied at the 
				// start of this file indicates what happens at the beginning, i.e. the direction as `theLastKnownEventToHaveOccurredUponTheUndoStack.wasAnIncrement = true`.
				theLastKnownEventToHaveOccurredUponTheUndoStack.wasAnIncrement = true;
				console.log('undoStack from processInput first go is :', undoStack);
				return;
			} 
				
			if (undoStack.length === 0 && theLastKnownEventToHaveOccurredUponTheUndoStack.wasAnIncrement === false) {
				// Reverse the direction of the arrow as `theLastKnownEventToHaveOccurredUponTheUndoStack.wasAnIncrement` but 
				// don't change what has already been kept on the stack at undoStack[0] by processOnUndoButton()
				theLastKnownEventToHaveOccurredUponTheUndoStack.wasAnIncrement = true;
				console.log('undoStack from processInput first go is :', undoStack);
				return;
			} 
			
			// Otherwise/else undoStack is not empty, i.e. undoStack.length is 1 or greater.
			// Condition upon whether the user has selected a new segment after inputting as many keys as she likes into the old one
			if (globalStoredDivIdOfBlob !== localInputDivIdOfBlob) {  // No match, i.e. we have moved to another box.	
				undoStack.push({
					id: globalLastGrabbedBlobFromDOM.id,
					blobHTML: globalLastGrabbedBlobFromDOM.innerHTML,
					textContent: globalLastGrabbedBlobFromDOM.textContent,
					length: globalLastGrabbedBlobFromDOM.textContent.length
				});
				// Now update the global variable as globalStoredDivIdOfBlob in order to perform this test the next time
				globalStoredDivIdOfBlob = localInputDivIdOfBlob;
				theLastKnownEventToHaveOccurredUponTheUndoStack.wasAnIncrement = true;
				console.log('undoStack from processInput is :', undoStack);
				return;
			} 	
		
		};

	function addSegmentToSplurge(mytext, id) {
		//console.log("OH NO!!");
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
		// Record the direction of array traversal by recording the last known event at undoStack.length === 2,, which means 
		// that after the pop() the length of the undoStack would thence become 1, 
			
		// Now put back onto the undoStack what we took off it if we have popped down to the final member.
		// If `theLastKnownEventToHaveOccurredUponTheUndoStack.wasAnIncrement === false` then the undoStack has been
		//  used before and nevertheless is now empty. The following occurs if the user has clicked undo button so 
		// many times that the undoStack is empty and then continues to type within the same blob div, i.e. when a 
		// performUndoEventFormat() occurs upon an empty undoStack. But it won't occur upon the increment-the-stack direction
		if (undoStack.length === 0 && theLastKnownEventToHaveOccurredUponTheUndoStack.wasAnIncrement === false) {
				if (globalLocalCachedUndoStackIsEmptiedBlob) {
					undoStack[0] = globalLocalCachedUndoStackIsEmptiedBlob;
				}
				theLastKnownEventToHaveOccurredUponTheUndoStack.wasAnIncrement === true;
		}

		if (undoStack.length === 1) {
			// undoStack at the end of this function.
			// We have only one element remaining on the stack so cache it as a local variable to be put back again onto the 
			globalLocalCachedUndoStackIsEmptiedBlob = undoStack[0];
		}


		// If we run out of object members on the stack, then the pop() from the stack will return undefined.
		const mostRecentFromStack = undoStack.pop();
		console.log('HELP undoStack from processOnUndoButton is ', undoStack);
		let grabbedBlobByIdFromDOM = document.getElementById(mostRecentFromStack.id);
		console.log('most recent from stack, :', mostRecentFromStack, 'grabbedBlobByIdFromDOM is, :', grabbedBlobByIdFromDOM.parentNode);
		// Logic is for smooth user experience depending upon where they left off when undo was pressed
		if (mostRecentFromStack.cursor) {	
			// if the last on stack was from a formatting alteration
			console.log('mostRecentFromStack from processOnUndoButton passsing to performUndoEventFormat:', mostRecentFromStack);
			console.log('grabbedBlobByIdFromDOM from processOnUndoButton passing to performUndoEventFormat :', grabbedBlobByIdFromDOM);
			// console.log('A b/it/u alteration');
			performUndoEventFormat(mostRecentFromStack, grabbedBlobByIdFromDOM);
			
		} else { // undoStack was empty before pop()
			// the last on stack is from a text alteration change
			console.log('mostRecentFromStack from processOnUndoButton passsing to performUndoEventTextChange: ', mostRecentFromStack);
			console.log('grabbedBlobByIdFromDOM from processOnUndoButton passing to performUndoEventTextChange :', grabbedBlobByIdFromDOM);
			// console.log('A text alteration ');					
			performUndoEventTextChange(mostRecentFromStack, grabbedBlobByIdFromDOM);
		}

		theLastKnownEventToHaveOccurredUponTheUndoStack.wasAnIncrement = false; 
		
		
		// We need to set the values of globalLastGrabbedBlobFromDOM so that when an UndoButton press occurs and 
		// the user subequently continues to press keys on the keyboard, without having clicked the mouse, the 
		// processInput() function will continue to work  
		globalLastGrabbedBlobFromDOM.id = grabbedBlobByIdFromDOM.id;
		globalLastGrabbedBlobFromDOM.textContent = grabbedBlobByIdFromDOM.textContent;	
		globalLastGrabbedBlobFromDOM.innerHTML = grabbedBlobByIdFromDOM.innerHTML;
		globalLastGrabbedBlobFromDOM.length = grabbedBlobByIdFromDOM.textContent.length;
		
		console.log('globalLastGrabbedBlobFromDOM from processMouseClick AFTER is ', globalLastGrabbedBlobFromDOM);
		console.log('grabbedBlobByIdFromDOM from processMouseClick AFTER is ', grabbedBlobByIdFromDOM);

		// Make sure we update extension from the webview.
		updateToExtUponFormattingChange(mostRecentFromStack, grabbedBlobByIdFromDOM);
	}

	function performUndoEventFormat (mostRecentFromUndoStack, grabbedBlobByIdFromDOM) {
			// This reverses a formatting change like bold, or underline
			console.log('undoStack from start of performUndoEventFormat', undoStack);
			console.log("From performUndoEventFormat mostRecentFromUndoStack, ", mostRecentFromUndoStack);

			// grab element from DOM. 
			console.log('From performUndoEventFormat grabbedBlobByIdFromDOM.children prior to it being updated is: ', grabbedBlobByIdFromDOM.children);

			// The following replaces a [textNode, tagElement, textNode] by a conglomerated textNode called newlyCreatedTotalTextNode 
			const whichCurrentNode = mostRecentFromUndoStack.cursor.middleNewNodes;
			console.log('grabbedBlobByIdFromDOM.childNodes are ', grabbedBlobByIdFromDOM.childNodes);
			const keptFormerText = grabbedBlobByIdFromDOM.childNodes[whichCurrentNode - 1].textContent;
			const keptInnerTextContent = grabbedBlobByIdFromDOM.childNodes[whichCurrentNode].textContent;
			const keptLatterText = grabbedBlobByIdFromDOM.childNodes[whichCurrentNode + 1].textContent;
			const newlyCreatedTotalTextNode = document.createTextNode(keptFormerText + keptInnerTextContent + keptLatterText);
			const nodeToBeReplaced = grabbedBlobByIdFromDOM.childNodes[whichCurrentNode - 1];
			nodeToBeReplaced.replaceWith(newlyCreatedTotalTextNode);
			grabbedBlobByIdFromDOM.childNodes[whichCurrentNode].remove();
			grabbedBlobByIdFromDOM.childNodes[whichCurrentNode].remove();
			console.log('From performUndoEventFormat grabbedBlobByIdFromDOM after it being updated is: ', newlyCreatedTotalTextNode);

			// update the DOM
			// grabbedBlobByIdFromDOM.outerHTML = mostRecentFromUndoStack.blobHTML;

			// Call restoreCursor to which function we pass the grabbed DOM element as div
			restoreCursorFromPerformUndoEventFormat(mostRecentFromUndoStack, grabbedBlobByIdFromDOM, newlyCreatedTotalTextNode);
		}

	// Restore the cursor position
	function restoreCursorFromPerformUndoEventFormat(mostRecentItemfromStack, grabbedBlobByIdFromDOM, newlyCreatedTotalTextNode) {
			console.log("argument passed to restoreCursorFromPerformUndoEventFormat is :", mostRecentItemfromStack);
			const myDivNumberFromUndoStack = mostRecentItemfromStack.id;
			const cursorState = mostRecentItemfromStack.cursor;

			console.log("cursorState is from restoreCursorFromPerformUndoEventFormat is:", cursorState);
			console.log('myDivNumberFromUndoStack from restoreCursorFromPerformUndoEventFormat is:', myDivNumberFromUndoStack);

			// const theGrabbedSplurgeFromDOM = document.getElementById('splurge');
			// const children = theGrabbedSplurgeFromDOM.children;
			// console.log('theGrabbedSplurgeFromDOM from restoreCursor is:', theGrabbedSplurgeFromDOM);

			// const selectedChildFromDOM = children[myDivNumberFromUndoStack];
			// console.log('selectedChildFromDOM is:', selectedChildFromDOM);
			
			//const theGrabbedBlobFromDOM = document.getElementById(myDivNumberFromUndoStack);
			console.log('grabbedBlobByIdFromDOM.childNodes[mostRecentItemfromStack.cursor.middleNewNodes - 1] from restoreCursor is: ', grabbedBlobByIdFromDOM.childNodes[mostRecentItemfromStack.cursor.middleNewNodes - 1]);

			// const selectedChildFromDOM = children[myDivNumberFromUndoStack];
			// console.log('selectedChildFromDOM is:', selectedChildFromDOM);
			// Set the start and end of the range to the desired offset

			console.log(
				'Node:', grabbedBlobByIdFromDOM.childNodes[mostRecentItemfromStack.cursor.middleNewNodes - 1],
				'Type:', grabbedBlobByIdFromDOM.childNodes[mostRecentItemfromStack.cursor.middleNewNodes - 1]?.nodeType,
				'Length:', grabbedBlobByIdFromDOM.childNodes[mostRecentItemfromStack.cursor.middleNewNodes - 1]?.length
			); 
			
			// Clear any existing selection and apply the new range
			// Create a new range object
			requestAnimationFrame(() => {
				grabbedBlobByIdFromDOM.focus();
				const restoreCursorUndoRange = document.createRange();
				restoreCursorUndoRange.setStart(newlyCreatedTotalTextNode, mostRecentItemfromStack.cursor.startOffset);
				restoreCursorUndoRange.setEnd(newlyCreatedTotalTextNode, mostRecentItemfromStack.cursor.endOffSet);
				console.log('startOffset and EndOffset to range :', mostRecentItemfromStack.cursor.startOffset, mostRecentItemfromStack.cursor.endOffSet);
				console.log('startOffset and EndOffset of range :', restoreCursorUndoRange.startOffset, restoreCursorUndoRange.endOffset);
				console.log('range from restoreCursorFromPerformUndoEventFormat is :', restoreCursorUndoRange);
				
				const mySelection = window.getSelection();
				mySelection.removeAllRanges();
				mySelection.addRange(restoreCursorUndoRange);
			});

			console.log('grabbedBlobByIdFromDOM is connected? ', grabbedBlobByIdFromDOM.isConnected);
			console.log('newlyCreatedTotalTextNode is connected? ', newlyCreatedTotalTextNode.isConnected);
			
			console.log('splurgeContainer.children[mostRecentItemfromStack.id].childNodes from restoreCursorUndoRange is ', splurgeContainer.children[mostRecentItemfromStack.id].childNodes);	
			console.log('newlyCreatedTotalTextNode is: ', newlyCreatedTotalTextNode);
			
			
			//console.log('mySelection from restoreCursor is :', mySelection);
		    //for (let i =0; i < cursorState.length; i++) {}

			// Was changed to the following to avoid a console.log error upon mix and matching the undo button with manual unbold, etc. 

			//range.setStartBefore(selectedChildFromDOM);
			//range.setEndAfter(selectedChildFromDOM);		
	}

	function performUndoEventTextChange (mostRecentItemFromStack, grabbedBlobByIdFromDOM) {
			//if (!undoStack[0]) { 
			//	return; 
			//};
			
			// let grabbedInnerDivByIdFromDOM = document.getElementById(undoStack[undoStack.length - 1].id);
			console.log("BOOGLIES!!!!!!");
			console.log('from DOM performUndoEventTextChange grabbedBlobByIdFromDOM :', grabbedBlobByIdFromDOM);
			console.log('From performUndoEventTextChange mostRecentItemFromStack :', mostRecentItemFromStack);

			console.log('undostack from start of performUndoEventTextChange', undoStack);
			console.log('document.getElementById[mostRecentItemFromStack.id] from performUndoEventTextChange BEFORE innerHTML operations', document.getElementById(mostRecentItemFromStack.id));
			
			grabbedBlobByIdFromDOM.innerHTML = mostRecentItemFromStack.blobHTML;
			//grabbedBlobByIdFromDOM.focus();
			// if (undoStack.length > 0){
				//}
			console.log('document.getElementById(mostRecentItemFromStack.id).childNodes from performUndoEventTextChange AFTER innerHTML operations', document.getElementById(mostRecentItemFromStack.id).childNodes);

			requestAnimationFrame(() => {
				grabbedBlobByIdFromDOM.focus();
				const anotherRestoreCursorUndoRange = document.createRange();
				let putCursorHere;
				if (mostRecentItemFromStack.length % 2 === 0) {
						putCursorHere = Math.floor(mostRecentItemFromStack.length / 2);
					} else { 
						putCursorHere = Math.floor(mostRecentItemFromStack.length / 2) + 1;
				}

				const familyOfNodes = document.getElementById(mostRecentItemFromStack.id).childNodes;
				let familyOfNodesLength = familyOfNodes.length;
				let currentTotalStringLength = 0; 

				console.log('familyOfNodes is ', familyOfNodes, 'familyOfNodesLength ', familyOfNodesLength, 'putCursorHere ', putCursorHere);
				
				
				let index = -1;
				for (let k = 0 ; (k < familyOfNodesLength) && (currentTotalStringLength <= putCursorHere) ;  k++) {
					if (familyOfNodes[k].nodeType === Node.ELEMENT_NODE || familyOfNodes[k].nodeType === Node.TEXT_NODE) {
						console.log('currentlength, putCursorHere, childNode ,', currentTotalStringLength, putCursorHere, familyOfNodes[k]);
						currentTotalStringLength += familyOfNodes[k].textContent.length;
						index = k;
					}
				} 

				let remainder;
				if (index > 0){
					remainder = currentTotalStringLength - putCursorHere;
				} else {
					remainder = putCursorHere;
				}

				console.log('index :', index, 'remainder :', remainder);

				if (index !== -1) {
					switch (familyOfNodes[index].nodeType) {
						case Node.TEXT_NODE || Node.ELEMENT_NODE:
							if (remainder === 0) {
								const extraChars = Math.ceil(familyOfNodes[k].textContent.length /2);
								anotherRestoreCursorUndoRange.setStart(familyOfNodes[index], extraChars);
								anotherRestoreCursorUndoRange.setEnd(familyOfNodes[index], extraChars);
							} else {
								const extraChars = Math.ceil(remainder / 2);
								anotherRestoreCursorUndoRange.setStart(familyOfNodes[index], extraChars);
								anotherRestoreCursorUndoRange.setEnd(familyOfNodes[index], extraChars);
							}
							break;
						default:
							console.log('Weird node type not recognised in performUndoEventTextChange!');
					}
				}
				console.log('set startOffset and EndOffset to range within performUndoEventTextChange: ', remainder, remainder);
				console.log('startOffset and EndOffset of range :', anotherRestoreCursorUndoRange.startOffset, anotherRestoreCursorUndoRange.endOffset);
				console.log('range from restoreCursorFromPerformUndoEventFormat is :', anotherRestoreCursorUndoRange);
				
				const mySelection = window.getSelection();
				mySelection.removeAllRanges();
				mySelection.addRange(anotherRestoreCursorUndoRange);	
			});
			console.log('globalStoredDivIdOfBlob from performUndoEventTextChange is ', globalStoredDivIdOfBlob);
		}

		function scrubTheBlob () {
			// console.log('globalClickBlobId is:', globalClickBlobId);
			let theGrabbedSplurge = document.getElementById('splurge');
			// console.log('theGrabbedSplurge is:', theGrabbedSplurge);
			let theGrabbedBlobFromDOM = theGrabbedSplurge.children[globalClickBlobId];
			// console.log('the grabbed child is:', theGrabbedBlobFromDOM);
			let theInnerHTML = theGrabbedBlobFromDOM.innerHTML;
			// console.log('theHTML prior is:', theInnerHTML);
			
			theInnerHTML = theInnerHTML.replace(/<(\/?(?:br|strong|em|u)\b)>/gi, '');
			theGrabbedBlobFromDOM.innerHTML = theInnerHTML;
			
			undoStack.push({
				id: theGrabbedBlobFromDOM.id,
				blobHTML: globalLastGrabbedBlobFromDOM.innerHTML
			});
			console.log('undoStack from scrubTheBlob', undoStack);
		}

		// The following function was added late in the day, for revision 2.0.0
		// It ensures that there can only ever be one consecutive \u200c in the DOM after a \u003c
		// Otherwise the invisible \u200c grows longer and longer in the ground truth json upon 
		// every "export to all formats".
		function processSplurgeDivs() {
			let lastChild = splurgeContainer.lastChild;
			for (const child of lastChild.childNodes) {
				if (child.nodeType === Node.TEXT_NODE) {
					child.data = child.data.replace(/\u200c/g, '');
				}
			}	
			
		}

		if (splurgeContainer) {
			// Run immediately in case divs are already there
			if (splurgeContainer.children.length > 0) {
				processSplurgeDivs();
			}

			// Also watch for any divs added later
			const observer = new MutationObserver(() => {
				// console.log('splurgeContainer length is:', splurgeContainer.children.length);
				processSplurgeDivs();
			});
			
			observer.observe(splurgeContainer, { childList: true });
		}

}());
