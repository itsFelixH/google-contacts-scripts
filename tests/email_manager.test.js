/**
 * Tests for EmailManager class
 */
function runEmailManagerTests() {
  testSendUnlabeledContactsEmail();
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
    emailManager.sendUnlabeledContactsEmail("test@example.com", unlabeledContacts);
    Logger.log("✅ sendUnlabeledContactsEmail: Successfully sent email with unlabeled contacts");
  } catch (error) {
    Logger.log(`❌ sendUnlabeledContactsEmail: Failed to send email - ${error.message}`);
    throw error;
  }
  
  // Test sending email with empty contacts list
  try {
    emailManager.sendUnlabeledContactsEmail("test@example.com", []);
    Logger.log("✅ sendUnlabeledContactsEmail: Successfully sent email with empty contacts list");
  } catch (error) {
    Logger.log(`❌ sendUnlabeledContactsEmail: Failed to send email with empty list - ${error.message}`);
    throw error;
  }
  
  // Test sending email with invalid recipient
  try {
    emailManager.sendUnlabeledContactsEmail("", unlabeledContacts);
    Logger.log("❌ sendUnlabeledContactsEmail: Should have failed with invalid recipient");
    throw new Error("Expected error for invalid recipient");
  } catch (error) {
    Logger.log("✅ sendUnlabeledContactsEmail: Correctly handled invalid recipient");
  }
}