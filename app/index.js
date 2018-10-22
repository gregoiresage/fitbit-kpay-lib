/*
 * Entry point for the watch app
 */
import document from "document";
import clock from "clock";
import * as messaging from 'messaging';


/**** BEGIN KPAY IMPORTS - REQUIRED ****/
/*
 * If you want (a lot of) logging from the KPay library,
 * replace "release" with "debug" in the import paths for
 * ALL KPAY IMPORTS below 
 *    ==> DO NOT MIX RELEASE AND DEBUG IMPORTS!
 */
// required imports
import * as kpay from './kpay/debug/kpay.js';
import * as kpay_common from '../common/kpay/kpay_common.js';

/* Choose which type of "companion => phone communications" you want to use:
 *   - file transfer: is more reliable, uses more memory
 *          ==> import './kpay/debug/kpay_filetransfer.js';
 *   - normal messaging: less reliable then file transfer, might cause frustration with the user if messaging fails, but uses less memory
 *          ==> import './kpay/debug/kpay_messaging.js';
 * If you do not run into memory issues with your app or clockface, we recommend you use the file transfer communications
 *
 * Check the comments in the "message" event handler at the bottom of this file how to save even more memory by forwarding all KPay communications yourself.
 */
import './kpay/debug/kpay_filetransfer.js';
//import './kpay/debug/kpay_messaging.js';

// optional imports, remove if not needed to save memory
import './kpay/debug/kpay_dialogs.js';			// remove if you handle KPay dialogs yourself
import './kpay/debug/kpay_time_trial.js';			// remove if you do not want a time based trial

/*
 *
 * Adding the import below will run an extra checksum on each incoming message to validate if it was really sent by our server
 * It makes your app harder to crack, but it will also cost you an extra 8.5kb of memory and make the app take longer to start
 * Take it out of comments if you are worried about security.
 * 
 */
import './kpay/debug/kpay_msg_validation.js';
/**** END KPAY IMPORTS ****/


/**** BEGIN DEMO CLOCK ****/
var myClock = document.getElementById("KPayDemoClock");
clock.granularity = 'seconds';

function setTime(date) {
  let newTime = ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2);
  myClock.text = newTime;
}

clock.ontick = (evt) => setTime(evt.date);
setTime(new Date());
/**** END DEMO CLOCK ****/


// In case you want to handle all KPay events yourself instead of using the standard KPay
// dialogs and messages, you can do that by:
//     1. comment the import of kpay_dialogs.js on top of this file so the standard dialogs are not loaded
//     2. catch all KPay events and handle them yourself as shown below:

/******* Uncomment the block below to handle your own KP events instead of using the standard dialogs *******/
/*
kpay.setEventHandler((e, data) => {
  switch (e) {
    case kpay_common.eventTypes.GenericError:
      //show generic error msg
      console.log("KPay GenericError event");
      break;
    case kpay_common.eventTypes.BluetoothUnavailable:
      //show connection to phone unavailable msg
      console.log("KPay BluetoothUnavailable event");
      break;
    case kpay_common.eventTypes.InternetUnavailable:
      //show internet connection unavailable msg
      console.log("KPay InternetUnavailable event");
      break;
    case kpay_common.eventTypes.TrialStarted:
      //(optional) show user msg he is in trial and how long it will last (data == Date with trial end time)
      console.log("KPay TrialStarted event; trial ends at " + data);
      break;
    case kpay_common.eventTypes.TrialEnded:
      //(optional) show user msg his trial ended and the purchase will start in a few seconds
      console.log("KPay TrialEnded event");
      break;
    case kpay_common.eventTypes.CodeAvailable:
      //show purchase code and purchase instructions (data == 5-digit purchase code ==> pad with zeroes up to 5 digits before displaying!!)
      console.log("KPay CodeAvailable event; purchase code is " + data);
      break;
    case kpay_common.eventTypes.PurchaseStarted:
      //(optional) show message telling the user to finish the purchase he started (data == 5-digit purchase code ==> pad with zeroes up to 5 digits before displaying!!)
      console.log("KPay PurchaseStarted event; purchase code is " + data);
      break;
    case kpay_common.eventTypes.Licensed:
      //thank the user for purchasing
      console.log("KPay Licensed event");
      break;
    default:
      break;
  };
});
*/


/**** KPAY INIT - REQUIRED ***/
kpay.initialize();

// After initializing the library, you can either wait for the time based trial to end 
// (when enabled with the import above)
// OR
// You can start the purchase yourself, even before the trial ends, by calling
// the function "kpay.startPurchase()" ==> for example a "purchase now!" button that 
// allows users to purchase before trial ends
//
// When not using the time based trial, this is the only way to start a purchase!
//kpay.startPurchase();

// all public KPay functions can be found in kpay.js (in debug/release folders)
// some KPay settings can be found in kpay_config.js


/**** BEGIN APP MESSAGING -- CAN BE REMOVED IF YOUR APP DOES NOT NEED MESSAGING ****/
messaging.peerSocket.addEventListener("open", () => {
  console.log("Communication onOpen called!");
});

messaging.peerSocket.addEventListener("message", (evt) => {
  let msg = evt.data;
  if (kpay_common.isKPayMessage(msg)) {
    /* 
      To save even more memory, it is possible to completely turn off KPay messaging and forward all KPay
      messages to the lib yourself.
      Do this by commenting both the "kpay_filetransfer.js" and "kpay_messaging.js" imports on top.
      Then call "kpay.processMessageFromCompanion(msg);" here to forward the message to our lib.
      
      DO NOT CALL THIS FUNCTION WITHOUT DISABLING THE IMPORTS FIRST!!
    */
    return;
  }
  
  // handle your own messages from companion to watch below this line!
  console.log("Communication onMessage called: " + JSON.stringify(msg));
});

messaging.peerSocket.addEventListener("close", (evt) => {
  console.log("Communication onClose called: " + JSON.stringify(evt));
});

messaging.peerSocket.addEventListener("error", (err) => {
  console.log("Communication onError called: " + err.code + " - " + err.message);
});
/**** END APP MESSAGING -- CAN BE REMOVED IF YOUR APP DOES NOT NEED MESSAGING ****/