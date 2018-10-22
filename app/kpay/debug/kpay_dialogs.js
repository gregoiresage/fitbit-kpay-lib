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

import document from "document";
import { vibration } from "haptics";
import { display } from "display";
import clock from "clock";
import { me } from "appbit";
import * as kc from './kpay_core.js';
import * as kcfg from '../kpay_config.js';
import * as kp from './kpay.js';
import * as kcm from '../../../common/kpay/kpay_common.js';
/*end of imports*/

var _errorDialog = null;
var _errorDialogMessage = null;

var _trialEndedDialog = null;
var _trialEndedMessage = null;
var _trialEndedCode = null;
var _dialogClock = null;
var _setDialogClockTime = null;

var _purchaseSuccessDialog = null;

function _initkpd() {
  console.log("KPay_dialogs - kpay_dialogs initialize called!");
  
  //check if internet permission is enabled; necesarry for kpay to function
  if (!me.permissions.granted("access_internet")) {
    console.log("KPay - ERROR: internet permission not enabled!");
    _showError("This app requires the \"Internet\" permission to be granted");
  }
  
  //register ourselves with the main lib to we can show the dialogs
  kc.setDialogCallbacks(_mainLibInitializing, _handleEvent, _hideAlert);
}

function _mainLibInitializing(isNewInstall) {
  console.log("KPay_dialogs - _mainLibInitialized()");
  
  if (isNewInstall && kcfg.KPAY_SHOW_PAID_APP_POPUP) {
    console.log("KPay_dialogs - Fresh install detected; showing paid app popup...");
    
    _showPaidAppPopup();
  }
}

function _get(id) {
  return document.getElementById(id);
}

function _showElement(el, show) {
  el.style.display = show ? 'inline' : 'none';
}

function _showPaidAppPopup() {
  //get popup
  let paidAppPopup = _get("paidAppPopup");
  
  //set text
  _get("paidAppPopupText").getElementById("#copy/text").text = kcfg.KPAY_PAID_APP_POPUP_TEXT;
  
  //hook up buttons
  _get("btnPaidAppOk").onclick = function(evt) {
    _showElement(paidAppPopup);    //hide the popup
  };
  _get("btnPaidAppAlreadyPaid").onclick = function(evt) {
    //get popup
    let alreadyPaidPopup = _get("alreadyPaidPopup");
    
    //hook up button
    _get("btnAlreadyPaidOk").onclick = function(evt) {
      _showElement(alreadyPaidPopup);    //hide the already paid popup
    };
    
    //show already paid popup
    _showElement(alreadyPaidPopup, true);    //show the already paid popup
    _showElement(paidAppPopup, false);    //hide the initial popup
  };
  
  //show popup
  _showElement(paidAppPopup, true);
}

function _handleEvent(e, data) {
  console.log("KPay_dialogs - _handleEvent(e == " + e + ", extraData == " + data + ")");
  switch (e) {
    case kcm.eventTypes.GenericError:
      _showError(kcfg.KPAY_UNKNOWN_ERROR_MSG);
      break;
    case kcm.eventTypes.BluetoothUnavailable:
      _showError(kcfg.KPAY_BLUETOOTH_UNAVAILABLE_MSG);
      break;
    case kcm.eventTypes.InternetUnavailable:
      _showError(kcfg.KPAY_INTERNET_UNAVAILABLE_MSG);
      break;
    case kcm.eventTypes.CodeAvailable:
      _showTrialEnded(kcfg.KPAY_CODE_AVAILABLE_MSG, data);
      break;
    case kcm.eventTypes.PurchaseStarted:
      _showTrialEnded(kcfg.KPAY_PURCHASE_STARTED_MSG, data);
      break;
    case kcm.eventTypes.Licensed:
      _showPurchaseSuccess();
      break;
    default:
      break;
  };
}

function _showError(message) {
  console.log("KPay_dialogs - _showError() - message == " + message);
  if (!_errorDialog) {
    _errorDialog = _get("kpay_errorDialog");
    _errorDialogMessage = _get("kpay_errorMessage");
  }
  
  _errorDialogMessage.text = message;
  
  //make sure the current time is still displayed
  _showTimeInDialog(); 
  
  //show error dialog
  _showElement(_errorDialog, true);
  _getUserAttention();
}

function _showTrialEnded(message, code) {
  console.log("KPay_dialogs - _showTrialEnded() - message == " + message + "; code == " + code);
  if (!_trialEndedDialog) {
    _trialEndedDialog = _get("kpay_trialEndedDialog");
    _trialEndedMessage = _get("kpay_trialEndedMessage");
    _trialEndedCode = _get("kpay_trialEndedCode");        
  }
  
  _trialEndedCode.text = _monoDigit(code);
  _trialEndedMessage.text = message;
  
  //make sure the current time is still displayed
  _showTimeInDialog(); 
  
  //show dialog
  _showElement(_trialEndedDialog, true);
  _getUserAttention();
}

function _showPurchaseSuccess() {
  console.log("KPay_dialogs - _showPurchaseSuccess()");
  if (!_purchaseSuccessDialog) {
    _purchaseSuccessDialog = _get("kpay_purchaseSuccessDialog");
  }
  
  //make sure the current time is still displayed
  _showTimeInDialog(); 
  
  //show purchase success
  _showElement(_purchaseSuccessDialog, true);
  
  //hide trial ended dialog
  if (_trialEndedDialog) {
    _showElement(_trialEndedDialog, false);
  }
  
  _getUserAttention("celebration-long");
  
  //hide again after 5 seconds
  setTimeout(_hideAlert, 5000);
}

function _hideAlert() {
  console.log("KPay_dialogs - _hideAlert()");
  //hide current time
  _hideTimeInDialog();
  
  //hide the dialog
  if (_errorDialog) {
    _showElement(_errorDialog, false);
  }
  if (_trialEndedDialog) {
    _showElement(_trialEndedDialog, false);
  }
  if (_purchaseSuccessDialog) {
    _showElement(_purchaseSuccessDialog, false);
  }
}

function _showTimeInDialog() {
  if (!_dialogClock) {
    //first time time is displayed
    _dialogClock = _get("kpay_timeInDialog");
  
    //make sure clock is updated while this dialog is displayed
    _setDialogClockTime = function() {
      let date = new Date();
      let newTime = ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2);
      _dialogClock.text = newTime;
    }
    
    clock.addEventListener('tick', () => {
      if (_dialogClock && _dialogClock.style.display == "inline") {
        _setDialogClockTime(); 
      }
    });
  }
  
  if (_dialogClock) {
    //show the clock
    _setDialogClockTime();
    _showElement(_dialogClock, true);
  }
}

function _hideTimeInDialog() {
  if (_dialogClock) {
    //hide the clock
    _showElement(_dialogClock, false);
  }
}

function _getUserAttention(pattern) {
  display.poke();
  vibration.start(pattern ? pattern : "nudge-max");
}
  
function _isErrorAlertDisplayed() {
  return _errorDialog && _errorDialog.style.display == "inline";
}

// // Convert a number to a special monospaced number
function _monoDigit(num) {
  let monoNum = '';
  while (num > 0) {
    monoNum = String.fromCharCode(0x10 + (num % 10)) + monoNum;
    num = (num / 10) | 0;
  }
  return monoNum;
}

_initkpd();