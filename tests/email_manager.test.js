/**
 * Tests for EmailManager class
 */
function runEmailManagerTests() {
  testSendUnlabeledContactsEmail();
  testSendContactsWithoutBirthdayEmail();
  testSendContactsWithLabelEmail();
}

function testSendUnlabeledContactsEmail() {
  // Create test contacts
  const contact1 = new Contact("Test User 1", new Date(), [], "test1@example.com", "City 1", "+1234567890");
  const contact2 = new Contact("Test User 2", new Date(), [], "test2@example.com", "City 2", "+0987654321");
  const unlabeledContacts = [contact1, contact2];
  
  // Create test email manager
  const emailManager = new EmailManager();
  
  // Test sending email with unlabeled contacts
  try {
    emailManager.sendUnlabeledContactsEmail(unlabeledContacts);
    Logger.log("✅ sendUnlabeledContactsEmail: Successfully sent email with unlabeled contacts");
  } catch (error) {
    Logger.log(`❌ sendUnlabeledContactsEmail: Failed to send email - ${error.message}`);
    throw error;
  }
  
  // Test sending email with empty contacts list
  try {
    emailManager.sendUnlabeledContactsEmail([]);
    Logger.log("✅ sendUnlabeledContactsEmail: Successfully sent email with empty contacts list");
  } catch (error) {
    Logger.log(`❌ sendUnlabeledContactsEmail: Failed to send email with empty list - ${error.message}`);
    throw error;
  }
}

function testSendContactsWithoutBirthdayEmail() {
  // Create test contacts
  const contact1 = new Contact("No Birthday 1", null, [], "test1@example.com", "City 1", "+1234567890");
  const contact2 = new Contact("No Birthday 2", '', [], "test2@example.com", "City 2", "+0987654321");
  const contactsWithoutBirthday = [contact1, contact2];
  
  // Create test email manager
  const emailManager = new EmailManager();
  
  // Test sending email with contacts without birthday
  try {
    emailManager.sendContactsWithoutBirthdayEmail(contactsWithoutBirthday);
    Logger.log("✅ sendContactsWithoutBirthdayEmail: Successfully sent email with contacts without birthday");
  } catch (error) {
    Logger.log(`❌ sendContactsWithoutBirthdayEmail: Failed to send email - ${error.message}`);
    throw error;
  }
  
  // Test sending email with empty contacts list
  try {
    emailManager.sendContactsWithoutBirthdayEmail([]);
    Logger.log("✅ sendContactsWithoutBirthdayEmail: Successfully sent email with empty contacts list");
  } catch (error) {
    Logger.log(`❌ sendContactsWithoutBirthdayEmail: Failed to send email with empty list - ${error.message}`);
    throw error;
  }
}

function testSendContactsWithLabelEmail() {
  // Create test contacts
  const contact1 = new Contact("Friend 1", new Date(), ["Friends"], "test1@example.com", "City 1", "+1234567890");
  const contact2 = new Contact("Friend 2", new Date(), ["Friends", "Work"], "test2@example.com", "City 2", "+0987654321");
  const labeledContacts = [contact1, contact2];
  
  // Create test email manager
  const emailManager = new EmailManager();
  
  // Test sending email with labeled contacts
  try {
    emailManager.sendContactsWithLabelEmail("Friends", labeledContacts);
    Logger.log("✅ sendContactsWithLabelEmail: Successfully sent email with labeled contacts");
  } catch (error) {
    Logger.log(`❌ sendContactsWithLabelEmail: Failed to send email - ${error.message}`);
    throw error;
  }
  
  // Test sending email with empty contacts list
  try {
    emailManager.sendContactsWithLabelEmail("Friends", []);
    Logger.log("✅ sendContactsWithLabelEmail: Successfully sent email with empty contacts list");
  } catch (error) {
    Logger.log(`❌ sendContactsWithLabelEmail: Failed to send email with empty list - ${error.message}`);
    throw error;
  }
  
  // Test sending email with empty label
  try {
    emailManager.sendContactsWithLabelEmail("", labeledContacts);
    Logger.log("❌ sendContactsWithLabelEmail: Should have failed with empty label");
    throw new Error("Expected error for empty label");
  } catch (error) {
    Logger.log("✅ sendContactsWithLabelEmail: Correctly handled empty label");
  }
}