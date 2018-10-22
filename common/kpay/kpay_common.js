/*
* K·Pay Integration Library - v1.2.6 - Copyright Kiezel 2018
* Last Modified: 2018-04-01
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

/**
  All events that can be fired by kpay lib.
*/
export var eventTypes = {
  BluetoothUnavailable: 0,   /**< Cannot send messages to phone */
  InternetUnavailable:  1,   /**< Cannot connect with kpay server */
  GenericError:         2,   /**< Generic error (e.g. invalid message format) */
  TrialStarted:         3,   /**< Trial has started (trial end time as extra data) ==> unlock all features available during trial */
  TrialEnded:           4,   /**< Trial has ended, kiezelpay lib is attempting to initiate the purchase on the server ==> disable all trial features */
  CodeAvailable:        5,   /**< A purchase transaction has been initiated on the kiezelpay server (purchase code as extra data) */
  PurchaseStarted:      6,   /**< The user entered the code on the kiezelpay website and purchase is in progress (purchase code as extra data) */
  Licensed:             7    /**< User has successfully completed the purchase and is now licensed to use your app ==> unlock all features available after purchase */
};

export function isKPayMessage(msg) {
  return msg && msg.isKpayMsg;
}

export var statusMessageFilename = 'kpay.status.cbor';
export var purchaseMessageFilename = 'kpay.purchase.cbor';