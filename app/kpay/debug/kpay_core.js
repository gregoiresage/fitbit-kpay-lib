/*
* K·Pay Integration Library - v1.2.6 - Copyright Kiezel 2018
* Last Modified: 2018-07-25
*
* BECAUSE THE LIBRARY IS LICENSED FREE OF CHARGE, THERE IS NO
* WARRANTY FOR THE LIBRARY, TO THE EXTENT PERMITTED BY APPLICABLE
* LAW. EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT
* HOLDERS AND/OR OTHER PARTIES PROVIDE THE LIBRARY "AS IS"
* WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED,
* INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
* MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE ENTIRE
* RISK AS TO THE QUALITY AND PERFORMANCE OF THE LIBRARY IS WITH YOU.
* SHOULD THE LIBRARY PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL
* NECESSARY SERVICING, REPAIR OR CORRECTION.
*
* IN NO EVENT UNLESS REQUIRED BY APPLICABLE LAW OR AGREED TO IN
* WRITING WILL ANY COPYRIGHT HOLDER, OR ANY OTHER PARTY WHO MAY
* MODIFY AND/OR REDISTRIBUTE THE LIBRARY AS PERMITTED ABOVE, BE
* LIABLE TO YOU FOR DAMAGES, INCLUDING ANY GENERAL, SPECIAL,
* INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE USE OR
* INABILITY TO USE THE LIBRARY (INCLUDING BUT NOT LIMITED TO LOSS
* OF DATA OR DATA BEING RENDERED INACCURATE OR LOSSES SUSTAINED BY
* YOU OR THIRD PARTIES OR A FAILURE OF THE LIBRARY TO OPERATE WITH
* ANY OTHER SOFTWARE), EVEN IF SUCH HOLDER OR OTHER PARTY HAS BEEN
* ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
*/ 

/*****************************************************************************************/
/*                 GENERATED CODE BELOW THIS LINE - DO NOT MODIFY!                       */
/*****************************************************************************************/

import * as fs from "fs";
import * as messaging from 'messaging';
import * as kcm from '../../../common/kpay/kpay_common.js';
import * as kcfg from '../kpay_config.js';
import * as kp from './kpay.js';
/*end of imports*/

var KPAY_APP_ID = 1278392827;

export var state = null;
var _useFileTransfer = false;

var flags = {
  purchaseInProgress: false,
  purchaseStarted: false,
  statusCheckingFinished: false,
  statusRequestsWithoutResponse: 0,
  companionConnectionFailures: 0,
  genericErrors: 0
};

var _lastEvent = null;
var _stateFilename = 'kps';
var _failsafeStatusCheckTimer = null;
var _failsafeStatusCheckInterval = 15000;
var _random = null;
var _lastPurchaseCode = null;

var _genericErrorsThreshold = 5;

var _hasTimeBasedTrial = false;
var _eventCb = function() { return false; };
var _eventDialogInitializeCallback = function() {};
var _eventDialogCb = function() {};
var _hideAlertCb = function() {};
var _timeTrialInitializeCallback = function() {};
var _timeTrialCompanionConnectionOpenCallback = function() {};
var _timeTrialCompanionMessageReceivedCallback = function() { return false; };
var _validationCb = function(msg, random, flags) { return true; }

/********************* KPAY WATCH ***********************/
//called upon app start
export function init() {
  console.log("KPay - _initialize()");

  if (_isNewInstall()) {
    console.log("KPay - Fresh install detected; generating new State...");

    //generate fresh state
    state = {
      stateLicensed: false,
      startInstallTime: new Date().getTime()
    };

    _timeTrialInitializeCallback(true);
    _eventDialogInitializeCallback(true);

    //save it
    console.log("KPay - Storing new State on fs");
    saveState();
  }
  else {
    //load stored state
    console.log("KPay - Loading existing State from fs");
    _loadState();
    console.log("KPay - Loaded State: " + JSON.stringify(state));

    _timeTrialInitializeCallback(false);
    _eventDialogInitializeCallback(false);
  }

  //set communication callbacks
  messaging.peerSocket.addEventListener("open", _timeTrialCompanionConnectionOpenCallback);

  //check if connection already opened before we initialized
  //this might cause 2 messages to be sent initially, but rather that then none at all...
  //messaging.peerSocket.OPEN === 0
  if (messaging.peerSocket.readyState === 0) {
    _timeTrialCompanionConnectionOpenCallback();
  }
}

/******************* companion communication *******************/
export function useFileTransfer() {
  _useFileTransfer = true;
}

export function processMessageFromCompanion(msg) {
  console.log("_onMessageFromCompanion()");
  if (_isStatusResponseMessage(msg)) {
    console.log("KPay - Message from companion: " + JSON.stringify(msg));
    if (flags.statusRequestsWithoutResponse > kcfg.StatusRequestsWithoutResponseThreshold) {
      _hideAlertCb();    //hide any alert that might have been shown before
    }
    flags.statusRequestsWithoutResponse = 0;
    _handleStatusResult(msg);
  }
  else if (msg && msg.purchase === 'start') {
    console.log("KPay - 'StartPurchase' message from companion");
    startPurchase();
  }
  else if (msg && msg.purchase === 'cancel') {
    console.log("KPay - 'CancelPurchase' message from companion");
    cancelPurchase();
  }
}

function _cancelFailsafeStatusCheckTimer() {
  console.log("KPay - _cancelFailsafeStatusCheckTimer()");
  if (_failsafeStatusCheckTimer !== null) {
    clearTimeout(_failsafeStatusCheckTimer);
    _failsafeStatusCheckTimer = null;
  }
}

export function startStatusChecksWithFailsafe(immediateCheck) {
  console.log("KPay - s tartStatusChecksWithFailsafe(immediateCheck == " + immediateCheck + ")");
  flags.statusCheckingFinished = false;
  scheduleFailsafeStatusCheck(immediateCheck);
}

export function scheduleFailsafeStatusCheck(immediateCheck) {
  console.log("KPay - s cheduleFailsafeStatusCheck(immediateCheck == " + immediateCheck + ")");
  _cancelFailsafeStatusCheckTimer();
  if (!flags.statusCheckingFinished) {
    if (immediateCheck) {
      _statusCheck();
    }
    if (_failsafeStatusCheckTimer === null) {   //if not null this means the sending failed and a recheck is already scheduled, no need to do it again
      console.log("KPay - scheduling failsafe check for over " + (_failsafeStatusCheckInterval/1000) + " seconds...");
      _failsafeStatusCheckTimer = setTimeout(function() { scheduleFailsafeStatusCheck(true); }, _failsafeStatusCheckInterval);
    }
  }
  else {
    console.log("KPay - scheduleFailsafeStatusCheck() - checking finished");
  }
}

export function endStatusReached() {
  console.log("KPay - e ndStatusReached()");
  _cancelFailsafeStatusCheckTimer();
  flags.statusCheckingFinished = true;
}

function _statusCheck() {
  console.log("KPay - _statusCheck()");

  //show that we are performing status checks
  flags.statusCheckingFinished = false;

  //check if our status requests reach their destination
  if (!kcfg.SuppressAllErrors &&
      _lastEvent !== kcm.eventTypes.CodeAvailable && 
      _lastEvent !== kcm.eventTypes.PurchaseStarted && 
      flags.companionConnectionFailures == 0 &&
      (!state.startInstallTime || ((new Date().getTime()) - state.startInstallTime) > kcfg.SupressConnectionErrorsTimeout)) {
    flags.statusRequestsWithoutResponse++;
  }

  if (flags.statusRequestsWithoutResponse > kcfg.StatusRequestsWithoutResponseThreshold) {
    //no response from kp server on the last x status requests, assume internet is not available
    //fire the event
    fireEvent(kcm.eventTypes.InternetUnavailable, null, false);
  }

  //send a msg to the companion to request the current status of this app
  //add random number to avoid replay attacks
  if (!_random) {
    _random = Math.round(Math.random() * 0xFFFFFFFF);
  }
  var msg = _createGetStatusMessage(KPAY_APP_ID, _random, _generateFlags(kcfg.KPAY_TEST_MODE, !_hasTimeBasedTrial));

  console.log("KPay - Sending status request message to companion...");
  _sendMessageToCompanion(msg);
}

function _generateFlags(testMode, trialDisabled) {
  /*
  KIEZELPAY_STATUS_CHECK_DEFAULT  = 1
  KIEZELPAY_TEST_MODE_ENABLED     = 1 << 1
  KIEZELPAY_TIME_TRIAL_DISABLED   = 1 << 2
  KIEZELPAY_V1_1                  = 1 << 3         //pebble only
  KIEZELPAY_LOW_MEMORY            = 1 << 4         //pebble only
  KIEZELPAY_V1_2                  = 1 << 5         //fitbit only
  FILE_TRANSFER_FOR_MESSAGING     = 1 << 6         //fitbit only
  */
  let generatedFlags = 1;
  if (testMode) {
    generatedFlags = (generatedFlags | (1 << 1));
  }
  if (trialDisabled || flags.purchaseStarted) {
    generatedFlags = (generatedFlags | (1 << 2));
  }
  generatedFlags = (generatedFlags | (1 << 5));       //use v1.2 of the API
  if (_useFileTransfer) {
    generatedFlags = (generatedFlags | (1 << 6));
  }

  return generatedFlags;
}

function _sendMessageToCompanion(msg) {
  console.log("KPay - _sendMessageToCompanion()");
  try {
    //messaging.peerSocket.OPEN === 0
    if (messaging.peerSocket.readyState === 0) {
      messaging.peerSocket.send(msg);

      //message sent!
      console.log("KPay - message sent succesfull!");
      if (flags.companionConnectionFailures > kcfg.CompanionConnectionFailuresThreshold) {
        _hideAlertCb();    //hide any alert that might have been shown before
      }
      flags.companionConnectionFailures = 0;
      return;
    }
  }
  catch (error) {
    console.error(JSON.stringify(error));
  }

  //there seems to be a problem with the connection with the watch
  _outboxFailedHandler(msg);
}

function _outboxFailedHandler(msg) {
  console.log("KPay - _outboxFailedHandler(): message sending failed!");

  if (flags.companionConnectionFailures > kcfg.CompanionConnectionFailuresThreshold) {
    //fire the event
    fireEvent(kcm.eventTypes.BluetoothUnavailable, null, false);
  }
  else if (!kcfg.SuppressAllErrors && (!state.startInstallTime || ((new Date().getTime()) - state.startInstallTime) > kcfg.SupressConnectionErrorsTimeout)) {
    flags.companionConnectionFailures++;
  }

  //try again in a little while
  console.log("KPay - try again in a little while...");
  startStatusChecksWithFailsafe(false);
}

export function startPurchase() {
  console.log("KPay - s tartPurchase()");

  if (!state.stateLicensed) {
    //store that the trial is over
    state.stateTrialEnded = true;
    flags.purchaseStarted = true;
    flags.statusCheckingFinished = false;
    saveState();

    //start doing status checks to initiate the purchase
    startStatusChecksWithFailsafe(true);
  }
}

export function cancelPurchase() {
  console.log("KPay - c ancelPurchase()");

  //send message cancelling the purchase
  var msg = _createCancelPurchaseMessage();

  //send the message!
  console.log("KPay - sending cancelPurchase message...");
  _sendMessageToCompanion(msg);

  if (!state.stateLicensed) {
    //store that the trial is not over
    state.stateTrialEnded = false;
    flags.purchaseStarted = false;
    saveState();

    //stop doing status checks and hide any purchase dialogs still visible
    endStatusReached();
    _hideAlertCb();

    //clear last event to make sure the purchase dialog is shown again if startPurchase() is called
    _lastEvent = null;
  }
}

/*messaging*/
function _createGetStatusMessage(appId, random, flags) {
  return {
    isKpayMsg: true,
    type: 0,
    appId: appId,
    random: random,
    flags: flags
  };
}

function _createCancelPurchaseMessage() {
  return {
    isKpayMsg: true,
    type: 3
  };
}

function _isStatusResponseMessage(msg) {
  return kcm.isKPayMessage(msg) && (msg.type === 1);
}

export function getStatus() {
  if (state.stateLicensed) {
    return "licensed";
  }
  if (state.stateTrialStarted && !state.stateTrialEnded) {
    return "trial";
  }
  return "unlicensed";
}

export function genericErrorOccurred() {
  console.log("KPay - g enericErrorOccurred()");
  if (flags.genericErrors > _genericErrorsThreshold) {
    //fire the event
    fireEvent(kcm.eventTypes.GenericError, null, false);
  }
  else if (!kcfg.SuppressAllErrors) {
    flags.genericErrors++;
  }
}

function _handleStatusResult(msg) {
  console.log("KPay - _handleStatusResult");

  //in NON low memory mode, each message has a checksum
  if (!_validationCb(msg, _random, _generateFlags(kcfg.KPAY_TEST_MODE, !_hasTimeBasedTrial))) {
    console.log("KPay - Invalid message received!");
    genericErrorOccurred();

    //try again
    startStatusChecksWithFailsafe(true);

    //do not proceed when msg invalid
    return;
  }

  //message is valid and we are going to check the results
  if (flags.genericErrors > _genericErrorsThreshold) {
    _hideAlertCb();    //hide any alert that might have been shown before
  }
  flags.genericErrors = 0;

  let response = msg.serverResponse;
  console.log("KPay - Server response received: " + JSON.stringify(response));
  if (response.status == 'licensed') {
    //valid license detected!
    state.stateLicensed = true;
    saveState();

    //fire the event
    fireEvent(kcm.eventTypes.Licensed, null, false);
    flags.purchaseInProgress = false;

    //stop the status checks, we're done
    endStatusReached();
  }
  else if (response.status == 'unlicensed') {
    state.stateLicensed = false;
    saveState();

    if (_lastEvent === kcm.eventTypes.Licensed) {
      _lastEvent = null;
    }
    flags.purchaseInProgress = true;

    let purchaseCode = Number(response.paymentCode);
    let forceEvent = (purchaseCode != _lastPurchaseCode);
    _lastPurchaseCode = purchaseCode;
    if (response.purchaseStatus == 'waitForUser') {
      //waiting for user to enter purchase code
      //fire the event
      fireEvent(kcm.eventTypes.CodeAvailable, purchaseCode, forceEvent);
    }
    else if (response.purchaseStatus == 'inProgress') {
      //user entered code and is purchasing
      fireEvent(kcm.eventTypes.PurchaseStarted, purchaseCode, forceEvent);
    }

    //keep checking until the purchase is done
    startStatusChecksWithFailsafe(true);
  }
  else if (!_timeTrialCompanionMessageReceivedCallback(response)) {
    //unknown message... try again
    console.log("KPay - Unsupported status: " + response.status);
    genericErrorOccurred();

    //try again
    startStatusChecksWithFailsafe(true);
  }
}

export function fireEvent(e, extraData, forceEvent) {
  console.log("KPay - f ireEvent()");
  if (_lastEvent !== e || forceEvent) {
    _lastEvent = e;

    //only fire the "Licensed" event if there was an actual purchase in progress, if there never was a purchase this
    //means the user deleted and reinstalled the app after previously purchasing it,
    //no need to show the "thank you for purchasing" message in that case...
    if (e !== kcm.eventTypes.Licensed || flags.purchaseInProgress) {
      //forward this event
      console.log("KPay - firing event callback for event " + e);
      try {
        if (!_eventCb(e, extraData)) {
          //user didn't handle this event, call standard event handling as well
          _eventDialogCb(e, extraData);
        }
      }
      catch(error) {}
    }
  }
}

export function getLastEvent() {
  return _lastEvent;
}
export function clearLastEvent() {
  _lastEvent = null;
}

/******************* set callbacks ***************************/
export function setEventHandler(eventCb) {
  _eventCb = eventCb;
}

export function setDialogCallbacks(initializeCb, eventCb, hideAlertCb) {
  _eventDialogInitializeCallback = initializeCb;
  _eventDialogCb = eventCb;
  _hideAlertCb = hideAlertCb;
}

export function setTimeTrialCallbacks(initializeCb, companionConnectionOpenCb, companionMessageReceivedCb) {
  _hasTimeBasedTrial = true;
  _timeTrialInitializeCallback = initializeCb;
  _timeTrialCompanionConnectionOpenCallback = companionConnectionOpenCb;
  _timeTrialCompanionMessageReceivedCallback = companionMessageReceivedCb;
}

export function setMessageValidationCallback(validationCb) {
  _validationCb = validationCb;
}

/******************* helper functions **************************/
function _isNewInstall() {
  try {
    let stats = fs.statSync(_stateFilename);
    return !(stats && stats.size);
  }
  catch (error) {
    return true;
  }
}

function _loadState() {
  if (!_isNewInstall()) {
    //the file exists, load the content
    state = fs.readFileSync(_stateFilename, "cbor");
  }
}

export function saveState() {
  console.log("KPay - s aveState()");
  fs.writeFileSync(_stateFilename, state, "cbor");
}