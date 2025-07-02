// TODO

/*
- Log contacts (sorted??, filtered??)
- Fix Phone Numbers
- Contacts with a specific label
- Contacts without any label
- Contact without birthday
- ...
*/


function testContacts() {
  var contactManager = new ContactManager();
  contactManager.logAllContacts();
}


function testLabels() {
  var labelManager = new LabelManager();
  labelManager.logAllLabels();
}


function runAllTests() {
  Logger.log("Running Contact Manager Tests...");
  Logger.log("================================");
  runContactManagerTests();
  
  Logger.log("\nRunning Label Manager Tests...");
  Logger.log("================================");
  runLabelManagerTests();
  
  Logger.log("\nRunning Email Manager Tests...");
  Logger.log("================================");
  runEmailManagerTests();
}


/**
 * Sends an email report of all contacts that don't have any labels assigned
 */
function sendUnlabeledContactsReport() {
  const contactManager = new ContactManager();
  const emailManager = new EmailManager();

  const unlabeledContacts = contactManager.findContactsWithoutLabels();
  emailManager.sendUnlabeledContactsEmail(toEmail, unlabeledContacts);

  Logger.log(`Sent unlabeled contacts report to ${toEmail} (${unlabeledContacts.length} contacts found)`);
}