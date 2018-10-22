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

import * as fs from "fs";
import { inbox } from "file-transfer";
import * as kcm from '../../../common/kpay/kpay_common.js';
import * as kc from './kpay_core.js';
/*end of imports*/

var KPAY_FILE_NAMES = [kcm.statusMessageFilename, kcm.purchaseMessageFilename];
var _otherFiles = [];
var _myFiles    = [];
var _prevNextFile = inbox.nextFile;


function _initkft() {
  console.log("KPay_filetransfer - kpay_filetransfer initialize called!");
  
  kc.useFileTransfer();
  inbox.addEventListener("newfile", _onMessageFromCompanion);
}

function _onMessageFromCompanion(evt) {
  console.log("KPay_filetransfer - _onMessageFromCompanion()");
  let file = _getNextKpayFile();
  if (file === undefined) return;
  
  //read file
  let msg = fs.readFileSync(file, "cbor");
  
  //forward to core
  kc.processMessageFromCompanion(msg);
}

inbox.nextFile = function() {
  if(_otherFiles.length > 0) {
    return _otherFiles.pop();
  }
  let fileName;
  while (fileName = _prevNextFile()) {
    if (KPAY_FILE_NAMES.indexOf(fileName) > -1) {
      _myFiles.push(fileName)
    }
    else {
      return fileName;
    }
  }
  return undefined;
}

function _getNextKpayFile() {
  if(_myFiles.length > 0) {
    return _myFiles.pop()
  }
  let fileName;
  while (fileName = _prevNextFile()) {
    if (KPAY_FILE_NAMES.indexOf(fileName) > -1) {
      return fileName;
    }
    _otherFiles.push(fileName);
  }
  return undefined;
}

_initkft();