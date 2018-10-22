/*
 * Entry point for the companion app
 */
import { me } from "companion"
import * as messaging from 'messaging';
import { settingsStorage } from "settings";

/**** BEGIN KPAY IMPORTS - REQUIRED ****/
/*
 * If you want (a lot of) logging from the KPay library,
 * replace "release" with "debug" in the import path below
 */
import * as kpay from './kpay/debug/kpay_companion.js';
import * as kpay_common from '../common/kpay/kpay_common.js';
/**** END KPAY IMPORTS ****/


// Use the block below to handle certain KP events in the companion.
// You can use these events to change visual representations in the settings page,
// but remember this status can potentially be tampered with because all security checks
// happen on the watch only!
// So only unlock premium features for real when the watch also agrees the status is Licensed!

// default implementation below will display trial duration in the settings page and allow users
// to end the trial earlier and pay for your app from within the settings page

/********  BEGIN KPAY SHOW TRIAL STATUS IN SETTINGS - CAN BE REMOVED IF YOU DO NOT WANT THIS FEATURE  ********/
/********  Special thanks to James Bernsen for sharing this code  ********/
function trialActive() {
  let trialEndDate = settingsStorage.getItem('kpayTrialEndDate');
  return trialEndDate && (JSON.parse(trialEndDate) > new Date().getTime());
}

kpay.setEventHandler((e, data) => {
  switch (e) {
    case kpay_common.eventTypes.TrialStarted:
      settingsStorage.setItem('kpayTrialEndDate', data.getTime());
      settingsStorage.setItem('btnEndTrialVisible', true);
      settingsStorage.setItem('kpayStatus', 'trial');   //actual message is generated in settings page
      break;
    case kpay_common.eventTypes.TrialEnded:
      settingsStorage.setItem('btnEndTrialVisible', false);
      settingsStorage.setItem('kpayStatus', `Unlicensed product. Trial period ended.`);
      break;
    case kpay_common.eventTypes.CodeAvailable:
    case kpay_common.eventTypes.PurchaseStarted:
      settingsStorage.setItem('btnEndTrialVisible', trialActive());
      settingsStorage.setItem('kpayStatus', `To continue using K·pay test product, please visit kzl.io/code and enter this code: ${data}`);
      break;
    case kpay_common.eventTypes.Licensed:
      settingsStorage.setItem('btnEndTrialVisible', false);
      settingsStorage.setItem('kpayStatus', `Licensed product. Thank you for your support!`);
      break;
    default:
      break;
  };
});


function handleKPayPurchaseSettingChange(newValue) {
  if (newValue) {
    settingsStorage.setItem('btnEndTrialVisible', trialActive());
    kpay.startPurchase();
  } 
  else if (trialActive()) {
    settingsStorage.setItem('kpayStatus', 'trial');   //actual message is generated in settings page
    kpay.cancelPurchase();
  }
}

settingsStorage.addEventListener('change', evt => {
  if (evt.key == 'kpayPurchase') {
    handleKPayPurchaseSettingChange(JSON.parse(evt.newValue));
  }
});

/********  END KPAY SHOW TRIAL STATUS IN SETTINGS - CAN BE REMOVED IF YOU DO NOT WANT THIS FEATURE  ********/


/**** KPAY CUSTOM ACCOUNTTOKEN - BE CAREFUL!! - DO NOT USE IF YOU DON'T UNDERSTAND THE CONSEQUENCES!! - ASK US FOR ADVICE BEFORE USING!! ***/
/*kpay.setAccountTokenGenerator(() => {
  //standard accounttoken is a random UUID which is stored in localstorage and
  //remains the same as long as the user does not uninstall the app.
  //only override this function if you can do something better!

  //generate a UNIQUE account token for this user here!
  //be VERY careful with that you do here. Remember that the accounttoken
  //is what identifies this user on the KPay server. So if you give all users
  //the same accounttoken, everyone will get your app for free after the first purchase!!
  
  //One option would be to return the user's Fitbit user ID here.
  //If you find a way to make the SAME user always have the SAME token for ALL YOUR APPS this
  //will make bundles much more user friendly. In that case the user does not have to
  //unlock each app from a bundle again.
  
  return "some cool unique token per user";
});*/


/**** KPAY INIT - REQUIRED ***/
kpay.initialize();

/**** BEGIN APP MESSAGING -- CAN BE REMOVED IF YOUR APP DOES NOT NEED MESSAGING ****/
messaging.peerSocket.addEventListener("open", () => {
  console.log("Communication onOpen called!");
});

messaging.peerSocket.addEventListener("message", (evt) => {
  let msg = evt.data;
  if (kpay_common.isKPayMessage(msg))
    return;   //this message is handled by the KPay lib
  
  //handle your own messages from watch to companion below this line!
  console.log("Communication onMessage called: " + JSON.stringify(msg));
});

messaging.peerSocket.addEventListener("close", (evt) => {
  console.log("Communication onClose called: " + JSON.stringify(evt));
});

messaging.peerSocket.addEventListener("error", (err) => {
  console.log("Communication onError called: " + err.code + " - " + err.message);
});
/**** END APP MESSAGING -- CAN BE REMOVED IF YOUR APP DOES NOT NEED MESSAGING ****/