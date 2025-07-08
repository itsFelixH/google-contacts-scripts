/**
 * Tests for EmailManager class
 */
function runEmailManagerTests() {
  testSendUnlabeledContactsEmail();
  testSendContactsWithoutBirthdayEmail();
  testSendContactsWithLabelEmail();
  testSendUpcomingBirthdaysEmail();
  testSendContactStatsEmail();
  testSendLabelStatsEmail();
  testEmailTemplates();
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

function testSendUpcomingBirthdaysEmail() {
  // Create test contacts with birthdays
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const contact1 = new Contact("Birthday 1", today, ["Friends"], "test1@example.com", "City 1", "+1234567890");
  const contact2 = new Contact("Birthday 2", nextWeek, ["Friends"], "test2@example.com", "City 2", "+0987654321");
  const upcomingBirthdays = [contact1, contact2];
  
  // Create test email manager
  const emailManager = new EmailManager();
  
  // Test sending email with upcoming birthdays
  try {
    emailManager.sendUpcomingBirthdaysEmail(upcomingBirthdays, 7);
    Logger.log("✅ sendUpcomingBirthdaysEmail: Successfully sent email with upcoming birthdays");
  } catch (error) {
    Logger.log(`❌ sendUpcomingBirthdaysEmail: Failed to send email - ${error.message}`);
    throw error;
  }
  
  // Test sending email with empty contacts list
  try {
    emailManager.sendUpcomingBirthdaysEmail([], 7);
    Logger.log("✅ sendUpcomingBirthdaysEmail: Successfully sent email with empty contacts list");
  } catch (error) {
    Logger.log(`❌ sendUpcomingBirthdaysEmail: Failed to send email with empty list - ${error.message}`);
    throw error;
  }
}

function testSendContactStatsEmail() {
  // Create test stats object
  const stats = {
    totalContacts: 100,
    withBirthday: 75,
    birthdayPercentage: 75,
    withEmail: 90,
    emailPercentage: 90,
    withPhone: 80,
    phonePercentage: 80,
    withCity: 70,
    cityPercentage: 70,
    withLabels: 85,
    labelPercentage: 85,
    withInstagram: 40,
    instagramPercentage: 40,
    labelDistribution: {
      "Friends": 50,
      "Family": 30,
      "Work": 20
    }
  };
  
  // Create test email manager
  const emailManager = new EmailManager();
  
  // Test sending email with stats
  try {
    emailManager.sendContactStatsEmail(stats);
    Logger.log("✅ sendContactStatsEmail: Successfully sent email with contact statistics");
  } catch (error) {
    Logger.log(`❌ sendContactStatsEmail: Failed to send email - ${error.message}`);
    throw error;
  }
}

function testSendLabelStatsEmail() {
  // Create test stats and labels
  const stats = {
    totalContacts: 100,
    withBirthday: 75,
    birthdayPercentage: 75,
    withEmail: 90,
    emailPercentage: 90,
    withPhone: 80,
    phonePercentage: 80,
    withCity: 70,
    cityPercentage: 70,
    withLabels: 85,
    labelPercentage: 85,
    withInstagram: 40,
    instagramPercentage: 40,
    labelDistribution: {
      "Friends": 50,
      "Family": 30,
      "Work": 20
    }
  };

  const allLabels = [
    { id: "label1", name: "Friends" },
    { id: "label2", name: "Family" },
    { id: "label3", name: "Work" }
  ];
  
  // Create test email manager
  const emailManager = new EmailManager();
  
  // Test sending email with label stats
  try {
    emailManager.sendLabelStatsEmail(stats, allLabels);
    Logger.log("✅ sendLabelStatsEmail: Successfully sent email with label statistics");
  } catch (error) {
    Logger.log(`❌ sendLabelStatsEmail: Failed to send email - ${error.message}`);
    throw error;
  }
}

function testEmailTemplates() {
  // Test birthdayList template
  try {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const contacts = [
      new Contact("Birthday 1", today, ["Friends"], "test1@example.com", "City 1", "+1234567890"),
      new Contact("Birthday 2", nextWeek, ["Friends"], "test2@example.com", "City 2", "+0987654321")
    ];
    
    const birthdayListHtml = EmailTemplates.birthdayList(contacts);
    if (!birthdayListHtml.includes("Birthday 1") || !birthdayListHtml.includes("Birthday 2")) {
      throw new Error("Birthday list template missing contact names");
    }
    Logger.log("✅ EmailTemplates.birthdayList: Successfully generated birthday list");
  } catch (error) {
    Logger.log(`❌ EmailTemplates.birthdayList: Failed to generate birthday list - ${error.message}`);
    throw error;
  }

  // Test statsReport template
  try {
    const stats = {
      totalContacts: 100,
      withBirthday: 75,
      birthdayPercentage: 75,
      withEmail: 90,
      emailPercentage: 90,
      withPhone: 80,
      phonePercentage: 80,
      withCity: 70,
      cityPercentage: 70,
      withLabels: 85,
      labelPercentage: 85,
      withInstagram: 40,
      instagramPercentage: 40,
      labelDistribution: {
        "Friends": 50,
        "Family": 30,
        "Work": 20
      }
    };
    
    const statsReportHtml = EmailTemplates.statsReport(stats);
    if (!statsReportHtml.includes("Total Contacts") || !statsReportHtml.includes("Label Distribution")) {
      throw new Error("Stats report template missing required sections");
    }
    Logger.log("✅ EmailTemplates.statsReport: Successfully generated stats report");
  } catch (error) {
    Logger.log(`❌ EmailTemplates.statsReport: Failed to generate stats report - ${error.message}`);
    throw error;
  }

  // Test labelStatsReport template
  try {
    const stats = {
      totalContacts: 100,
      withLabels: 85,
      labelPercentage: 85,
      labelDistribution: {
        "Friends": 50,
        "Family": 30,
        "Work": 20
      }
    };

    const allLabels = [
      { id: "label1", name: "Friends" },
      { id: "label2", name: "Family" },
      { id: "label3", name: "Work" }
    ];
    
    const labelStatsHtml = EmailTemplates.labelStatsReport(stats, allLabels);
    if (!labelStatsHtml.includes("Label Overview") || !labelStatsHtml.includes("Label Distribution")) {
      throw new Error("Label stats template missing required sections");
    }
    if (!labelStatsHtml.includes("progress-bar")) {
      throw new Error("Label stats template missing progress bars");
    }
    Logger.log("✅ EmailTemplates.labelStatsReport: Successfully generated label stats report");
  } catch (error) {
    Logger.log(`❌ EmailTemplates.labelStatsReport: Failed to generate label stats report - ${error.message}`);
    throw error;
  }

  // Test empty lists
  try {
    const emptyBirthdayList = EmailTemplates.birthdayList([]);
    if (!emptyBirthdayList.includes("No upcoming birthdays found")) {
      throw new Error("Birthday list template should show empty state message");
    }
    Logger.log("✅ EmailTemplates.birthdayList: Successfully handled empty list");
  } catch (error) {
    Logger.log(`❌ EmailTemplates.birthdayList: Failed to handle empty list - ${error.message}`);
    throw error;
  }
}