/*
* K·Pay Integration Library - v1.2.6 - Copyright Kiezel 2018
* Last Modified: 2018-06-07
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

//import { localStorage } from "local-storage"
var localStorageModule = require('local-storage').localStorage;    //because normal import currently doesn't work on Android
import { device } from "peer";
import * as messaging from 'messaging';
import { outbox } from "file-transfer";
import * as cbor from 'cbor';
import * as kcm from '../../../common/kpay/kpay_common.js';
/*end of imports*/

/******************* globals *******************/

var _libraryVersion = "fb1.2.1";

var _statusCheckInterval = 3000;
var _statusCheckTimeout = 5000;
var _failsafeStatusCheckInterval = 15000;
var _websocketKeepAliveInterval = 25000;
var _websocketRetryAfterFailureInterval = 10000;
var _defaultRecheckInterval = 86400*1000;		//1 day

var _checkStatusTimer = null;
var _checkStatusFailsafeTimer = null;
var _periodicRecheckTimer = null;
var _websocketKeepAliveTimer = null;
var _websocketConnectFailCheckTimer = null;
var _websocketRetryAfterFailureTimer = null;

var _nextRecheckTimeLocalstorageKey = "kpay_nextRecheckTimeLocalstorageKey";
var _lastStatusResultLocalstorageKey = "kpay__lastStatusResultLocalstorageKey";
var _flagsLocalstorageKey = "kpay_flagsLocalstorageKey";
var _appIdLocalstorageKey = "kpay_appIdLocalstorageKey";
var _randLocalstorageKey = "kpay_randLocalstorageKey";
var _accountTokenLocalstorageKey = "kpay_accountTokenLocalstorageKey";

var _appId = null;
var _random = null;
var _flags = null;

var _lastStatusResult = null;
var _statusChecksRunning = false;
var _statusRecheckRunning = false;
var _lastStatusCheckTimestamp = 0;
var _lastResponseReceivedTimestamp = 0;
var _lastWebSocketResponseReceivedTimestamp = 0;
var _websocketConnected = false;
var _websocketCheckingFailed = false;    //when true, revert to normal polling checks

var _currentPaymentCode = 0;
var _websocketConnection = null;

var _lastEvent = null;
var _eventCb = function() {};
var _getAccountTokenCb = _getAccountToken;

export function initialize() {
  console.log("KPay - initialize()");
  
  //attempt to set up communications with the watch app
  messaging.peerSocket.addEventListener("open", _onWatchConnectionOpen);
  messaging.peerSocket.addEventListener("message", _onMessageFromWatch);
  messaging.peerSocket.addEventListener("error", _onWatchConnectionError);
  messaging.peerSocket.addEventListener("closed", _onWatchConnectionClosed);
   
  //check if a recheck needs to be done in 1 minute, so everything has some time to startup
  setTimeout(_checkForStoredRecheck, 60000);
}

export function setEventHandler(eventCb) {
  _eventCb = eventCb;
}

// use to create your own implementation for the accounttoken (e.g. the fitbit user id?)
export function setAccountTokenGenerator(accountTokenGenerator) {
	_getAccountTokenCb = accountTokenGenerator;
}

export function startPurchase() {
  _sendMessageToWatch(kcm.purchaseMessageFilename, { purchase: 'start' });
}

export function cancelPurchase() {
  _sendMessageToWatch(kcm.purchaseMessageFilename, { purchase: 'cancel' });
}

function _sendMessageToWatch(name, msg, successCb, errorCb) {
  var successHandler = function() {
    if (successCb) {
      successCb();
    }
    else {
      console.log("KPay - Successfully sent kpay settings \"" + name + "\": " + JSON.stringify(msg));
    }
  };
  
  var errorHandler = function(error) {
    if (errorCb) {
      errorCb();
    }
    else {
      console.log("KPay - Error sending kpay settings \"" + name + "\": " + error);
    }
  };
  
  //if no flags are set yet and we don't know on which channel the watch is listening, send it over both to be sure...
  if (_flags == null || _useFileTransferForMessaging()) {
    console.log("KPay - sending message to watch using file transfer...");
    //use file tranfer
    outbox.enqueue(name, cbor.encode(msg))
      .then(successHandler)
      .catch(errorHandler);
  }
  
  if (_flags == null || _useNormalMessaging()) {
    console.log("KPay - sending message to watch using peersocket...");
    //use normal messaging
    try {
      //messaging.peerSocket.OPEN === 0
      if (messaging.peerSocket.readyState === 0) {
        messaging.peerSocket.send(msg);
        successHandler();
      }
      else {
        errorHandler("PeerSocket closed");
      }
    }
    catch (error) {
      errorHandler(error);
    }
  }
}

function _useFileTransferForMessaging() {
  return !_useNormalMessaging();
}

function _useNormalMessaging() {
  return (_flags & (1 << 6)) == 0;
}

function _onWatchConnectionOpen() {
  //let watch initialize status checking when necesarry
  console.log("KPay - Connection with watch opened...");
  
  if (_getLastStatusResult() !== null && _getLastStatusResult().status !== 'licensed') {
    //only keep the licensed status in storage between startups of the app, we just want to prevent
    //the periodic rechecks sending messages to the watch all the time
    _clearLastStatusResult();
  }
}

function _onMessageFromWatch(evt) {
  let msg = evt.data;
  if (!kcm.isKPayMessage(msg))
    return;   //this message was not intended for the KPay lib
  
  console.log("KPay - Received msg from watch: " + JSON.stringify(msg));
  if (_isGetStatusMessage(msg)) {
    console.log("KPay - Received GETSTATUS msg from watch...");
    
    if (_statusChecksRunning && _appId === msg.appId && _random === msg.random && _flags === msg.flags) {
      var now = new Date().getTime();
      if (_websocketConnected && !_websocketCheckingFailed && (now - _lastWebSocketResponseReceivedTimestamp) < _websocketKeepAliveInterval) {
        //websocket connected and running as it should, no need to force another request
        console.log("KPay - Websocket connected and alive, no need to start new status request...");
        return;
      }

      //checks are already running, make sure they have not crashed/stopped for some reason
      if ((now - _lastResponseReceivedTimestamp) < _statusCheckTimeout) {
        //all is running fine, no need to force another request
        console.log("KPay - Status checks already running, no need to start new status request...");
        return;
      }
    }
    
    //check status on KP server
    _appId = msg.appId;
    _random = msg.random;
    _flags = msg.flags;
    
    if (_getLastStatusResult() !== null && _getLastStatusResult().status !== 'unlicensed') {
      //we are in trial or licensed, and yet the watch is asking for the status... its stored status might be corrupt for some reason
      //make sure we send it the actual status we receive and don't block it here...
      _clearLastStatusResult();
    }
    _statusCheck();
    
    if (_checkStatusFailsafeTimer) {
        clearTimeout(_checkStatusFailsafeTimer);
        _checkStatusFailsafeTimer = null;
    }
    _checkStatusFailsafeTimer = setTimeout(_failSafeStatusCheck, _failsafeStatusCheckInterval);
  }
  else if (_isCancelPurchaseMessage(msg)) {
    console.log("KPay - Received CANCELPURCHASE msg from watch...");
    
    //stop status checking
    _statusChecksRunning = false;
    _clearLastStatusResult();
    if (_checkStatusTimer) {
      clearTimeout(_checkStatusTimer);
      _checkStatusTimer = null;
    }
    if (_checkStatusFailsafeTimer) {
      clearTimeout(_checkStatusFailsafeTimer);
      _checkStatusFailsafeTimer = null;
    }
    if (_websocketConnected) {
      _cancelWebsocketConnection();
    }
  }
}

function _isGetStatusMessage(msg) {
  return kcm.isKPayMessage(msg) && (msg.type === 0);
}

function _isCancelPurchaseMessage(msg) {
  return kcm.isKPayMessage(msg) && (msg.type === 3);
}

function _createStatusResponseMessage(serverResponse) {
  return {
    isKpayMsg: true,
    type: 1,
    serverResponse: serverResponse
  };
}

function _onWatchConnectionError(err) {
  console.log("KPay - Connection with watch error: " + err);
}

function _onWatchConnectionClosed(evt) {
  console.log("KPay - Connection with watch was closed: " + evt);
}

/******************* status checking *******************/
function _statusCheck() {
  console.log("KPay - _statusCheck()");
  _statusChecksRunning = true;
   
  let now = new Date().getTime();
  
  let accounttoken = _getAccountTokenCb();
  let platform = _getPlatform();
  
  //build url
  let kiezelpayStatusUrl = 'https://api.k-pay.io/api/v1/status?';
  kiezelpayStatusUrl += 'appid=' + encodeURIComponent(_appId);
  kiezelpayStatusUrl += '&rand=' + encodeURIComponent(_random);
  kiezelpayStatusUrl += '&accounttoken=' + encodeURIComponent(accounttoken);
  kiezelpayStatusUrl += '&platform=' + encodeURIComponent(platform);
  kiezelpayStatusUrl += '&flags=' + encodeURIComponent(_flags);
  kiezelpayStatusUrl += '&nocache=' + encodeURIComponent(now);
  kiezelpayStatusUrl += '&libv=' + encodeURIComponent(_libraryVersion);
  console.log("KPay - Getting status from server at " + kiezelpayStatusUrl);
  
  //perform the request
  _lastStatusCheckTimestamp = now;
  fetch(kiezelpayStatusUrl).then(function(response) {
      return response.json();
    }).then(function(jsonResponse) {
      console.log("KPay - Got response from server: " + JSON.stringify(jsonResponse));
      _statusRecheckRunning = false;
      _lastResponseReceivedTimestamp = new Date().getTime();
      if (!jsonResponse || !jsonResponse.hasOwnProperty('status')) {
        console.log("KPay - Invalid KPay response received.");
        return;
      }
      _processStatusResponse(jsonResponse);
    }).catch(function (error) {
      console.log('KPay - Status request failed: ' + error);
      _lastResponseReceivedTimestamp = new Date().getTime();
      
      if (!_statusRecheckRunning && _statusChecksRunning && (_getLastStatusResult() === null || _getLastStatusResult().status !== 'licensed')) {
        //try again in a few seconds (if this was not a recheck)
        if (_checkStatusTimer) {
          clearTimeout(_checkStatusTimer);
          _checkStatusTimer = null;
        }
        _checkStatusTimer = setTimeout(_statusCheck, _statusCheckInterval);
      }
      _statusRecheckRunning = false;
    });
}

function _processStatusResponse(response) {
  if (response.status === 'unlicensed') {
    _currentPaymentCode = Number(response.paymentCode);
  }

  if (_getLastStatusResult() === null || _getLastStatusResult().status !== response.status ||
      (_getLastStatusResult().status === 'unlicensed' && 
       (
         _getLastStatusResult().purchaseStatus !== response.purchaseStatus ||
         _getLastStatusResult().paymentCode !== response.paymentCode
       )
      )
     ) {
    
    //something changed, notify the watch
    _sendMessageToWatch(kcm.statusMessageFilename, _createStatusResponseMessage(response), function() {
      console.log('KPay - Status msg successfully sent to watch');
	  
      //check if we need to throw an event here as well
      if (response.status === 'licensed') {
        _fireEvent(kcm.eventTypes.Licensed, null, false);
      }
      else if (response.status === 'trial') {
        let newTrialEndTime = Math.round(new Date().getTime() / 1000) + Number(response.trialDurationInSeconds);
        let trialEndDate = new Date(); 
        trialEndDate.setTime(newTrialEndTime * 1000);
        _fireEvent(kcm.eventTypes.TrialStarted, trialEndDate, false);
      }
      else if (response.status === 'unlicensed') {
        let purchaseCode = Number(response.paymentCode);
        let forceEvent = (_getLastStatusResult() == null || (purchaseCode !== _getLastStatusResult().paymentCode));

        if (response.purchaseStatus == 'waitForUser') {
          //waiting for user to enter purchase code
          //fire the event
          _fireEvent(kcm.eventTypes.CodeAvailable, purchaseCode, forceEvent);
        }
        else if (response.purchaseStatus == 'inProgress') {
          //user entered code and is purchasing
          _fireEvent(kcm.eventTypes.PurchaseStarted, purchaseCode, forceEvent);
        }
      }

      //store last received status for next time
      _setLastStatusResult(response);
      }, function() {
        console.log('KPay - Status msg failed sending to watch');
      });
  }
  else {
    //no changes, no need to notify the watch
    console.log('KPay - No status change detected');
  }

  //check if we need to open the websocket
  if (response.status === 'licensed' || response.status === 'trial') {
    
    if (response.status === 'licensed') {
      //set up periodic recheck fallback
      _setPeriodicRechecksForResponse(response);
    }
    else {
      _removeScheduledRecheck();    //no rechecks when in trial; only when licensed
    }

    //stop checking
    _statusChecksRunning = false;
    if (_checkStatusFailsafeTimer) {
      clearTimeout(_checkStatusFailsafeTimer);
      _checkStatusFailsafeTimer = null;
    }
    _cancelWebsocketConnection();

    console.log('KPay - Licensed/trial status reached, no more action necesarry.');
  }
  else {
    _removeScheduledRecheck();    //no rechecks when unlicensed; only when licensed
    
    if (!_websocketCheckingFailed && !_websocketConnected) {
      //the purchase has started, begin checking with websockets till the purchase is done
      _beginWebSocketChecks();
    }
    else if (_websocketCheckingFailed) {
      //websockets have failed, use the old polling checks instead
      if (_checkStatusTimer) {
        clearTimeout(_checkStatusTimer);
        _checkStatusTimer = null;
      }
      
      _checkStatusTimer = setTimeout(_statusCheck, _statusCheckInterval);
    }    
  }
}

function _fireEvent(e, extraData, forceEvent) {
  if (_lastEvent !== e || forceEvent) {
    _lastEvent = e;
    
    console.log("KPay - firing event callback for event " + e);
    try {
      _eventCb(e, extraData);
    }
    catch (error) {}
  }
}

function _failSafeStatusCheck() {
  console.log("KPay - _failSafeStatusCheck()");
  let now = new Date().getTime();
  
  //_lastWebSocketResponseReceivedTimestamp
  if (_statusChecksRunning && 
      (
        (_websocketConnected && !_websocketCheckingFailed && (now - _lastWebSocketResponseReceivedTimestamp) >= _websocketKeepAliveInterval) ||
        ((!_websocketConnected || _websocketCheckingFailed) && (now - _lastResponseReceivedTimestamp) >= _failsafeStatusCheckInterval)
      ) &&
      (_getLastStatusResult() === null || (_getLastStatusResult().status !== 'licensed' && _getLastStatusResult().status !== 'trial'))) {
    //status checks have stopped for some reason, restart them
    console.log("KPay - status checks have stopped for some reason, restarting...");
    if (_checkStatusTimer) {
      clearTimeout(_checkStatusTimer);
      _checkStatusTimer = null;
    }
    _checkStatusTimer = setTimeout(_statusCheck, 0);
  }
  
  if (_checkStatusFailsafeTimer) {
    clearTimeout(_checkStatusFailsafeTimer);
    _checkStatusFailsafeTimer = null;
  }
  _checkStatusFailsafeTimer = setTimeout(_failSafeStatusCheck, _failsafeStatusCheckInterval);
}

function _setPeriodicRechecksForResponse(response) {
  console.log("KPay - _setPeriodicRechecksForResponse()");
  if (response && response.status === 'licensed') {
    let recheckTimeout = (response.validityPeriodInDays * 86400) * 1000;   
    _scheduleRecheckWithTimeout(recheckTimeout, false);
  }
}

function _checkForStoredRecheck() {
  let nextRecheckTime = _loadNumberFromLocalStorage(_nextRecheckTimeLocalstorageKey, null);
  console.log("KPay - _checkForStoredRecheck(); nextRecheckTime from ls = " + nextRecheckTime);
  if (nextRecheckTime !== null) {
    let now = new Date();
    let recheckTimeout = nextRecheckTime - now.getTime();
    _scheduleRecheckWithTimeout(recheckTimeout, true);
  }
}

function _scheduleRecheckWithTimeout(recheckTimeout, isStartupScheduling) {
  console.log("KPay - _scheduleRecheckWithTimeout(recheckTimeout = " + recheckTimeout + ", isStartupScheduling = " + isStartupScheduling + ")");
   
  if (!isStartupScheduling) {
    //store all data we will need for the rechecks (only when we know we have this data)
    _storeValueInLocalStorage(_flagsLocalstorageKey, _flags);
    _storeValueInLocalStorage(_appIdLocalstorageKey, _appId);
    _storeValueInLocalStorage(_randLocalstorageKey, _random);
  }
  
  if (recheckTimeout < 0) {
    _performRecheck();
  }
  else {
    //store the next recheck time in localstorage
    _storeScheduledRecheck(recheckTimeout);
  }
}

function _storeScheduledRecheck(recheckTimeout) {
  console.log("KPay - _storeScheduledRecheck(recheckTimeout = " + recheckTimeout + ")");
  _removeScheduledRecheck();
  
  //store new recheck
  let nextRecheckTime = new Date();
  let recheckSeconds = (recheckTimeout / 1000);
  nextRecheckTime.setSeconds(nextRecheckTime.getSeconds() + recheckSeconds);
  _storeValueInLocalStorage(_nextRecheckTimeLocalstorageKey, nextRecheckTime.getTime());
  
  //set timer for recheck
  console.log('KPay - Scheduling js status recheck for ' + recheckSeconds + ' seconds from now.');
  if (_periodicRecheckTimer) {
    clearTimeout(_periodicRecheckTimer);
    _periodicRecheckTimer = null;
  }
  _periodicRecheckTimer = setTimeout(_performRecheck, recheckTimeout);
}

function _removeScheduledRecheck() {
  console.log("KPay - _removeScheduledRecheck()");
  if (_periodicRecheckTimer) {
    clearTimeout(_periodicRecheckTimer);
    _periodicRecheckTimer = null;
  }
  _removeValueFromLocalStorage(_nextRecheckTimeLocalstorageKey);
}

function _performRecheck() {
  console.log("KPay - _performRecheck()");
  //load stored data necesarry for rechecks
  _flags = _loadNumberFromLocalStorage(_flagsLocalstorageKey, _flags);
  _appId = _loadNumberFromLocalStorage(_appIdLocalstorageKey, _appId);
  _random = _loadNumberFromLocalStorage(_randLocalstorageKey, _random);
  
  //whatever happens this recheck, make sure we try again in a day
  _storeScheduledRecheck(_defaultRecheckInterval);
  
  //check if the recheck should be performed at this moment
  if (_statusChecksRunning)
    return;    //no re-checks when the normal status checks are running
  
  //start the status checks
  console.log('KPay - Performing js fallback status recheck...');
  _statusRecheckRunning = true;
  _statusCheck();
}

function _beginWebSocketChecks() {
  console.log("KPay - _beginWebSocketChecks()");
  if (_websocketCheckingFailed || _websocketConnected || _websocketConnection !== null) {
    return;
  }
  
  let accounttoken = _getAccountTokenCb();
  let platform = _getPlatform();
  
  let registerMsg = {
    type: "register",
    purchaseCode: _currentPaymentCode,
    data: {
      appid: _appId,
      accounttoken: accounttoken,
      platform: platform,
      flags: _flags,
      random: _random,
      libv: _libraryVersion
    }
  };
  
  //attempt to connect the websocket
  let websocketUrl = 'wss://socket.kiezelpay.com';
  console.log('KPay - Opening websocket connection to KPay...');
  //check if the socket opened after a few seconds
  if (_websocketConnectFailCheckTimer) {
    clearTimeout(_websocketConnectFailCheckTimer);
    _websocketConnectFailCheckTimer = null;
  }
  _websocketConnectFailCheckTimer = setTimeout(function() {
    if (!_websocketConnected) {
      console.log('KPay - Opening websocket failed, reverting to normal polling checks...');
      _websocketCheckingFailed = true;    //failure, revert to old polling behaviour     
      _statusCheck();
      _retryWebsocketConnectionAfterFailure();
    }
  }, 3000);
  try {
    _websocketConnection = new WebSocket(websocketUrl);
    _websocketConnection.onopen = function(e) {
      _websocketConnected = true;
      _websocketCheckingFailed = false;
      console.log('KPay - WebSocket connection opened...');
      
      //send register message
      _sendWebsocketMessage(_websocketConnection, registerMsg);
    };
    _websocketConnection.onmessage = function(e) {
      if (!_websocketConnected) {
        //this socket should not be open
        try {
          _websocketConnection.close();
          console.log('KPay - Closing stray WebSocket...');
        }
        catch(ex) {}
        return;
      }
      
      //check message
      _lastWebSocketResponseReceivedTimestamp = new Date().getTime();
      console.log('KPay - WebSocket message received: ' + e.data);
      let msg = JSON.parse(e.data);
      
      if (msg && msg.type == "registerReponse" && msg.keepAliveTimeout) {
        //we are registered on the server
        //begin the keepAlive timer to prevent the heroku router from closing this websocket connection
        _websocketKeepAliveInterval = msg.keepAliveTimeout;
        if (_websocketKeepAliveTimer) {
          clearTimeout(_websocketKeepAliveTimer);
          _websocketKeepAliveTimer = null;
        }
        //set new keepalive for this socket
        _websocketKeepAliveTimer = setTimeout(
          function() { 
            _websocketKeepAlive(_websocketConnection);
          }, _websocketKeepAliveInterval);
      }
      else if (msg && msg.type == "statusUpdate") {
        if (!msg.data || !msg.data.hasOwnProperty('status')) {
          console.log("KPay - Invalid KPay response received: " + e.data);
          return;
        }
        _processStatusResponse(msg.data);
      }
      else {
        console.log("KPay - Unknown KPay response received: " + e.data);
      }
    };
    _websocketConnection.onerror = function(error) {
      console.log('KPay - WebSocket error: ' + error);
      _websocketConnected = false;
      _websocketCheckingFailed = true;    //failure, revert to old polling behaviour
      try {
        console.log('KPay - Closing websocket...');
        _websocketConnection.close();
      }
      catch (ex) {}
      _websocketConnection = null;
      _retryWebsocketConnectionAfterFailure();
      
      console.log('KPay - Starting polling status checks...');
      //start status polling checks
      _statusCheck();
    };
    _websocketConnection.onclose = function(event){
      if (_websocketConnected) {
        _websocketConnected = false;
        if (_websocketConnection !== null) {
          console.log('KPay - Closing websocket...');
          try {
            console.log('KPay - Closing websocket...');
            _websocketConnection.close();
          }
          catch (ex) {}
        }
        _websocketConnection = null;
        _websocketCheckingFailed = true;    //failure, revert to old polling behaviour
        _retryWebsocketConnectionAfterFailure();
        console.log('KPay - WebSocket closed by server: ' + event);
        
        console.log('KPay - Starting polling status checks...');
        //start status polling checks
        _statusCheck();
      }
    };
  }
  catch (ex) {
    console.log('KPay - Exception opening websocket: ' + ex);
  }
}

function _websocketKeepAlive(ws) {
  if (_websocketCheckingFailed) {
    return;
  }
  
  var keepAliveMsg = {
    type: "keepAlive"
  };
  _sendWebsocketMessage(ws, keepAliveMsg);
  if (_websocketKeepAliveTimer !== null) {
    clearTimeout(_websocketKeepAliveTimer);
    _websocketKeepAliveTimer = null;
  }
  _websocketKeepAliveTimer = setTimeout(
    function() { 
      _websocketKeepAlive(ws);
    }, _websocketKeepAliveInterval);
}

function _retryWebsocketConnectionAfterFailure() {
  if (_websocketRetryAfterFailureTimer) {
    clearTimeout(_websocketRetryAfterFailureTimer);
    _websocketRetryAfterFailureTimer = null;
  }
  
  console.log('KPay - Scheduling websocket retry...');
  //after a few seconds, clear the error to the websockets can be tried again
  _websocketRetryAfterFailureTimer = setTimeout(
    function() { _websocketCheckingFailed = false; }, 
    _websocketRetryAfterFailureInterval);
}

function _sendWebsocketMessage(ws, msgData) {
  try {
    if (ws.readyState === 1) {
      let msgToSend = JSON.stringify(msgData);
      console.log('KPay - Sending webSocket message: ' + msgToSend);
      ws.send(msgToSend);
    }
    else {
      console.log('KPay - Error sending webSocket message: readyState !== 1');
      _handleWebsocketError();
    }
  }
  catch(error) {
    console.log('KPay - Error sending webSocket message: ' + error);
    _handleWebsocketError();
  }
}

function _handleWebsocketError() { 
  _websocketConnected = false;
  _websocketCheckingFailed = true;    //failure, revert to old polling behaviour
  try {
    console.log('KPay - Closing websocket...');
    _websocketConnection.close();
  }
  catch (ex) {}
  _websocketConnection = null;

  //retry this later again
  _retryWebsocketConnectionAfterFailure();

  //start status polling checks
  console.log('KPay - Starting polling status checks...');
  _statusCheck();
}

function _cancelWebsocketConnection() {
  console.log('KPay - Cancelling websocket status checking...');
  if (_websocketKeepAliveTimer !== null) {
    clearTimeout(_websocketKeepAliveTimer);
    _websocketKeepAliveTimer = null;
  }
  _websocketConnected = false;
  if (_websocketConnection !== null) {
    try {
      _websocketConnection.close();
    }
    catch (ex) {}
  }
  _websocketConnection = null;
  _statusChecksRunning = false;
}

function _toByteArray(hexStringValue) {
  let bytes = [];
  for (var i = 0; i < hexStringValue.length; i += 2) {
    bytes.push(parseInt(hexStringValue.substr(i, 2), 16));
  }
  return bytes;
}

//default account token generation, can be overridden by developer
function _getAccountToken() {
  let accountToken = localStorageModule.getItem(_accountTokenLocalstorageKey);
  if (accountToken === null || accountToken === undefined || accountToken === "undefined") {
    accountToken = _uuidv4();
    _storeValueInLocalStorage(_accountTokenLocalstorageKey, accountToken); 
  }
  
  return accountToken;
}

function _clearLastStatusResult() {
  _lastStatusResult = null;
  _removeValueFromLocalStorage(_lastStatusResultLocalstorageKey);
}

function _setLastStatusResult(lastStatusResult) {
  _lastStatusResult = lastStatusResult;
  
  //also store in localstorage
  _storeValueInLocalStorage(_lastStatusResultLocalstorageKey, JSON.stringify(_lastStatusResult));
}

function _getLastStatusResult() {
  if (_lastStatusResult === null) {
    //check if stored in localstorage
    let lastStatusResultAsString = localStorageModule.getItem(_lastStatusResultLocalstorageKey);
    if (lastStatusResultAsString !== null && lastStatusResultAsString !== undefined && lastStatusResultAsString !== "undefined") {
      _lastStatusResult = JSON.parse(lastStatusResultAsString);
    }
  }
  
  return _lastStatusResult;
}

function _uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function _getPlatform() {
  return device.modelName.toLowerCase();
}

function _loadNumberFromLocalStorage(name, _default) {
  let value = localStorageModule.getItem(name);
  if (value !== null && value !== undefined && value !== "undefined" && !isNaN(value)) {
    var numberValue = Number(value);
    if (!isNaN(numberValue)) {
      return numberValue;
    }
  }
  
  return _default;
}

function _storeValueInLocalStorage(name, value) {
  if (value !== null && value !== undefined) {
    localStorageModule.setItem(name, value.toString());
  }
}

function _removeValueFromLocalStorage(name) {
  localStorageModule.removeItem(name);
}
