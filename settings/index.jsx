function mySettings(props) {
    const { settings, settingsStorage } = props;

    let kpayStatusMessage = settings.kpayStatus || "Unlicensed product. Trial period in progress.";
    let endTrialVisible = (settings.btnEndTrialVisible === undefined ? false : JSON.parse(settings.btnEndTrialVisible));
    if (kpayStatusMessage == 'trial') {
      kpayStatusMessage = getTrialEndsInMessage(props);
    }
    
    return (
      <Page>
        <Section title={<Text bold align="center">Product Status</Text>}>
          <Text align="center">{`${kpayStatusMessage}`}</Text>
          { endTrialVisible && <Toggle settingsKey="kpayPurchase" label="End Trial Now" /> }  
        </Section>
        
        { /*put your own config sections below this line*/ }
      </Page>);
}

function getTrialEndsInMessage(props) {
  let trialEndDate = props.settings.kpayTrialEndDate;
  let trialDuration = trialEndDate ? trialEndDate - new Date().getTime() : 0;
  if (!trialEndDate) {
    //there has not been any contact with the server yet, so trail time left is unknown
    return "Unlicensed product. Trial period in progress.";
  }
  
  if (trialDuration > 0) {
    return `Unlicensed product. Trial ends in ${getFuzzyDuration(trialDuration)}`;
  }
  
  // Returned in the case where the user ended the trial early,
  // and while in this condition, the trial period also ended.
  return "Unlicensed product. Trial period ended.";
}


function getFuzzyDuration(durationInMilliseconds) {
  //get duration in minutes, rounded up
  let durationInMinutes = Math.ceil(durationInMilliseconds / 60000.0);
  let numberOfHours = Math.floor(durationInMinutes / 60);
  let numberOfMinutes = durationInMinutes - (numberOfHours * 60);

  let fuzzyDuration = "";
  if (numberOfHours > 0) {
    fuzzyDuration = numberOfHours + " hrs, ";
  }
  return fuzzyDuration + numberOfMinutes + " min.";
}

registerSettingsPage(mySettings);