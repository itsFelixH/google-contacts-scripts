// TODO

/*
- Log contacts (sorted??, filtered??)
- Fix Phone Numbers
- Contacts with a specific label
- Contacts without any label
- Contact without birthday
- ...
*/


/**
 * Sends an email report of all contacts that don't have any labels assigned
 */
function sendUnlabeledContactsReport() {
  const contactManager = new ContactManager();
  const emailManager = new EmailManager();

  const unlabeledContacts = contactManager.findContactsWithoutLabels();
  emailManager.sendUnlabeledContactsEmail(unlabeledContacts);

  Logger.log(`Sent unlabeled contacts report (${unlabeledContacts.length} contacts found)`);
}

/**
 * Sends an email report of all contacts that don't have a birthday set
 */
function sendContactsWithoutBirthdayReport() {
  const contactManager = new ContactManager();
  const emailManager = new EmailManager();

  const contactsWithoutBirthday = contactManager.findContactsWithoutBirthday();
  emailManager.sendContactsWithoutBirthdayEmail(contactsWithoutBirthday);

  Logger.log(`Sent contacts without birthday report (${contactsWithoutBirthday.length} contacts found)`);
}

/**
 * Sends an email report of all contacts that have a specific label
 * @param {string} label The label to filter contacts by
 */
function sendContactsWithLabelReport(label) {
  if (!label) {
    throw new Error('Label parameter is required');
  }

  const contactManager = new ContactManager();
  const emailManager = new EmailManager();

  const labeledContacts = contactManager.findContactsWithLabel(label);
  emailManager.sendContactsWithLabelEmail(label, labeledContacts);

  Logger.log(`Sent contacts with label "${label}" report (${labeledContacts.length} contacts found)`);
}


// TESTING

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
