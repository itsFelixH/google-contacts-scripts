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