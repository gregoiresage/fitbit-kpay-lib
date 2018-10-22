/*
* K·Pay Integration Library - v1.2.6 - Copyright Kiezel 2018
* Last Modified: 2017-10-26
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

import * as messaging from 'messaging';
import * as kp from './kpay.js';
import * as kc from './kpay_core.js';
import * as kcm from '../../../common/kpay/kpay_common.js';
/*end of imports*/

var _trialEndTimer = null;

function _initkpt() {
  kc.setTimeTrialCallbacks(_mainLibInitializing, _companionConnectionOpened, _companionMessageReceived);
}

function _mainLibInitializing(isNewInstall) {
  console.log("KPay_time_trial - _mainLibInitialized()");
  
  if (isNewInstall) {
    console.log("KPay_time_trial - Fresh install detected; appending State with trial info...");
    
    //extend state with trial data
    kc.state.stateTrialEnded = false;
    kc.state.stateTrialStarted = false;
    kc.state.stateTrialEndTime = null;
  }
  
  //check for startup actions
  if (!kc.state.stateLicensed) {
    if (kc.state.stateTrialStarted && kc.state.stateTrialEndTime !== null) {
      //time based trial is running, start a timer that fires on end of trial
      _scheduleTrialEndTimer();
    }
    else {
      //no trial running (yet), but it does have to be controlled by kpay lib
      //make sure ppl cannot use our stuff for free by just disabling communications, 
      //start a failsafe timer to begin status checking without communications opening as well
      kc.scheduleFailsafeStatusCheck(false);
    }
  }
}

function _companionConnectionOpened() {
  console.log("KPay_time_trial - Connection with companion opened...");
  
  //check if any action is required
  //determine the initial status of this app at startup (fresh install, in trial, trial ended, licensed)
  if ((!kc.state.stateTrialStarted || kc.state.stateTrialEnded) && !kc.state.stateLicensed) {
    //this app has a time based trial managed by the KP server, we can perform a status check without starting an unwanted purchase
    console.log("KPay_time_trial - initialized; starting status checks");
    kc.startStatusChecksWithFailsafe(true);
  }
  else {
    console.log("KPay_time_trial - initialized; no action necesarry");
  }
}

function _companionMessageReceived(response) {
  if (response.status == 'trial') {
    //we are in trial mode
    //calc the time at which the trial will end
    let newTrialEndTime = Math.round(new Date().getTime() / 1000) + Number(response.trialDurationInSeconds);

    if (!kc.state.stateTrialStarted || !kc.state.stateTrialEndTime || kc.state.stateTrialEndTime > newTrialEndTime) {
      //update state
      kc.state.stateLicensed = false;
      if (kc.getLastEvent() === kcm.eventTypes.Licensed) {
        kc.clearLastEvent();
      }
      kc.state.stateTrialStarted = true;  
      kc.state.stateTrialEndTime = newTrialEndTime;
      kc.saveState();

      //fire event to show trial started (or end time updated), don't care if user handles it, we dont do anything with it
      let trialEndDate = new Date(); 
      trialEndDate.setTime(kc.state.stateTrialEndTime * 1000);
      kc.fireEvent(kcm.eventTypes.TrialStarted, trialEndDate, false);
    }

    //status checking is done for now, until the trial ends
    kc.endStatusReached();

    //start a timer that fires on end of trial
    _scheduleTrialEndTimer();
    
    return true;
  }

  return false;
}

function _endTrialCallback() {
  console.log("KPay_time_trial - _endTrialCallback()");
  _trialEndTimer = null;
  _endTrial();
}

function _scheduleTrialEndTimer() {
  console.log("KPay_time_trial - _scheduleTrialEndTimer()");
   
  let now = Math.round(new Date().getTime() / 1000);
  if (kc.state.stateTrialEnded || (kc.state.stateTrialStarted && now >= kc.state.stateTrialEndTime)) {
    //already ended!
    console.log("KPay_time_trial - trial already ended!");
    _endTrial();
  }
  else if (kc.state.stateTrialStarted && now < kc.state.stateTrialEndTime) {
    //start timer which ends when the trial ends
    console.log("KPay_time_trial - Scheduling trial to end in " + (kc.state.stateTrialEndTime - now) + " seconds.");
    _trialEndTimer = setTimeout(_endTrial, (kc.state.stateTrialEndTime - now) * 1000);
  }
}

function _endTrial() {
  console.log("KPay_time_trial - _endTrial()");
  
  if (!kc.state.stateLicensed) {  
    kc.fireEvent(kcm.eventTypes.TrialEnded, null, false);
    kc.startPurchase();
  }
}

_initkpt();