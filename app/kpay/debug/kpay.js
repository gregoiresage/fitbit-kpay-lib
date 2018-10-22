/*
* K·Pay Integration Library - v1.2.6 - Copyright Kiezel 2018
* Last Modified: 2018-04-11
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

import * as kc from './kpay_core.js';

/** Call once on watchface/app init before using any other functions */
export function initialize() {
  kc.init();
}

/**
  Signal the kpay lib that the user needs to purchase to continue. You need to call this when 
  there is no trial (KPAY_DISABLE_TIME_TRIAL == true), you can call also it when you do have a trial
  in case you want to start the purchase process before the trial ends. If you dont call it in that case
  the purchase will start automatically as soon as the trial ends
*/
export function startPurchase() {
  kc.startPurchase();
}

/**
  Signal the kpay lib that a purchase is no longer necesarry (e.g. the user backed out of the premium feature and does not want to use it anyway).
*/
export function cancelPurchase() {
  kc.cancelPurchase();
}

/**
  Get the current status for this user; 3 possible values:
    - "unlicensed"  ==> user does not yet have a valid license and is not in a time trial
    - "trial"       ==> user is currently in a time trial
    - "licensed"    ==> user has a valid license
    
  BEWARE: this function can return the wrong result in the situation that a user deleted the app AFTER having purchased it, then later reinstalls the app. 
  In that case the library "thinks" this is a clean install and will NOT return the status "licensed" until there was communication with the 
  kpay server and it received the licensed status from the kpay server (should not be more then a few seconds after installation). 
  Keep this in mind when showing messages to the user based on the result of this function.
*/
export function getStatus() {
  return kc.getStatus();
}

/**
  Optionally set an event handler if you want to handle any of the events defined in /common/kpay_common.js
  Callback has 2 paramters: 
    - 'eventType' (from set define above)
    - 'extraData' in case of the 'TrialStarted' event this is the trial end time (type Date); for 'CodeAvailable' and 'PurchaseStarted' event this is the purchase code (5-digit int)
*/
export function setEventHandler(callback) {
  kc.setEventHandler(callback);
}




/**
  CAREFUL - ADVANCED FEATURES BELOW - USE AT YOUR OWN RISK - MIGHT BREAK KPAY FUNCIONALITY
  
  Use the functions below if you want to disable all built-in KPay messaging functionality and take care of delivering the messages to KPay yourself.
  Make sure you DO NOT IMPORT any of the 2 communication files in your app when using these functions!
*/

/*
  Use this function to tell KPay in which way you want to receive the messages from companion to watch.
  Default way is peersocket.
  If you want file transfer, call this function at startup.
*/
export function useFileTransfer() {
  kc.useFileTransfer();
}

/*
  Call this function to forward messages you receive that are intended for KPay
*/
export function processMessageFromCompanion(msg) {
  kc.processMessageFromCompanion(msg);
}