/**
 * @fileoverview Google Contacts Scripts - Main entry points for contact management
 * @author Felix H
 * @version 1.0.0
 */

/**
 * Sends an email report of all contacts that don't have any labels assigned
 * @throws {Error} When contact fetching or email sending fails
 */
function sendUnlabeledContactsReport() {
  try {
    const contactManager = new ContactManager();
    const emailManager = new EmailManager();

    const unlabeledContacts = contactManager.findContactsWithoutLabels();
    
    if (unlabeledContacts.length === 0) {
      Logger.log('No unlabeled contacts found');
      return;
    }
    
    emailManager.sendUnlabeledContactsEmail(unlabeledContacts);
    Logger.log(`Sent unlabeled contacts report (${unlabeledContacts.length} contacts found)`);
  } catch (error) {
    Logger.log(`Error in sendUnlabeledContactsReport: ${error.message}`);
    throw error;
  }
}

/**
 * Sends an email report of all contacts that don't have a birthday set
 * @throws {Error} When contact fetching or email sending fails
 */
function sendContactsWithoutBirthdayReport() {
  try {
    const contactManager = new ContactManager();
    const emailManager = new EmailManager();

    const contactsWithoutBirthday = contactManager.findContactsWithoutBirthday();
    
    if (contactsWithoutBirthday.length === 0) {
      Logger.log('No contacts without birthday found');
      return;
    }
    
    emailManager.sendContactsWithoutBirthdayEmail(contactsWithoutBirthday);
    Logger.log(`Sent contacts without birthday report (${contactsWithoutBirthday.length} contacts found)`);
  } catch (error) {
    Logger.log(`Error in sendContactsWithoutBirthdayReport: ${error.message}`);
    throw error;
  }
}

/**
 * Sends an email report of all contacts that have a specific label
 * @param {string} label - The label to filter contacts by
 * @throws {Error} When label is invalid or operation fails
 */
function sendContactsWithLabelReport(label) {
  try {
    if (!label || typeof label !== 'string' || !label.trim()) {
      throw new Error('Label parameter is required and must be a non-empty string');
    }

    const contactManager = new ContactManager();
    const emailManager = new EmailManager();

    const labeledContacts = contactManager.findContactsWithLabel(label.trim());
    
    if (labeledContacts.length === 0) {
      Logger.log(`No contacts found with label "${label}"`);
      return;
    }
    
    emailManager.sendContactsWithLabelEmail(label, labeledContacts);
    Logger.log(`Sent contacts with label "${label}" report (${labeledContacts.length} contacts found)`);
  } catch (error) {
    Logger.log(`Error in sendContactsWithLabelReport: ${error.message}`);
    throw error;
  }
}

/**
 * Sends an email report of contacts with upcoming birthdays
 * @param {number} [days=7] - Number of days to look ahead
 * @throws {Error} When days parameter is invalid or operation fails
 */
function sendUpcomingBirthdaysReport(days = 7) {
  try {
    if (typeof days !== 'number' || days < 1 || days > 365) {
      throw new Error('Days parameter must be a number between 1 and 365');
    }

    const contactManager = new ContactManager();
    const emailManager = new EmailManager();

    const upcomingBirthdays = contactManager.findContactsWithUpcomingBirthdays(days);
    
    if (upcomingBirthdays.length === 0) {
      Logger.log(`No upcoming birthdays found in the next ${days} days`);
      return;
    }
    
    emailManager.sendUpcomingBirthdaysEmail(upcomingBirthdays, days);
    Logger.log(`Sent upcoming birthdays report (${upcomingBirthdays.length} contacts found)`);
  } catch (error) {
    Logger.log(`Error in sendUpcomingBirthdaysReport: ${error.message}`);
    throw error;
  }
}

/**
 * Sends an email report of contacts without surnames (only first name)
 * @throws {Error} When contact fetching or email sending fails
 */
function sendContactsWithoutSurnamesReport() {
  try {
    const contactManager = new ContactManager();
    const emailManager = new EmailManager();

    const contactsWithoutSurnames = contactManager.findContactsWithoutSurnames();
    
    if (contactsWithoutSurnames.length === 0) {
      Logger.log('No contacts without surnames found');
      return;
    }
    
    emailManager.sendContactsWithoutSurnamesEmail(contactsWithoutSurnames);
    Logger.log(`Sent contacts without surnames report (${contactsWithoutSurnames.length} contacts found)`);
  } catch (error) {
    Logger.log(`Error in sendContactsWithoutSurnamesReport: ${error.message}`);
    throw error;
  }
}

/**
 * Sends an email report of contacts with potentially invalid phone numbers
 * @throws {Error} When contact fetching or email sending fails
 */
function sendInvalidPhonesReport() {
  try {
    const contactManager = new ContactManager();
    const emailManager = new EmailManager();

    const contactsWithInvalidPhones = contactManager.findContactsWithInvalidPhones();
    
    if (contactsWithInvalidPhones.length === 0) {
      Logger.log('No contacts with invalid phone numbers found');
      return;
    }
    
    emailManager.sendInvalidPhonesEmail(contactsWithInvalidPhones);
    Logger.log(`Sent invalid phone numbers report (${contactsWithInvalidPhones.length} contacts found)`);
  } catch (error) {
    Logger.log(`Error in sendInvalidPhonesReport: ${error.message}`);
    throw error;
  }
}

/**
 * Sends a comprehensive statistics report including both contact and label statistics
 * @throws {Error} When statistics generation or email sending fails
 */
function sendStatisticsReport() {
  try {
    const contactManager = new ContactManager();
    const labelManager = new LabelManager();
    const emailManager = new EmailManager();

    const stats = contactManager.generateContactStats();
    const allLabels = labelManager.fetchLabels();
    
    // Use appropriate method based on what's available
    if (typeof emailManager.sendCombinedStatsEmail === 'function') {
      emailManager.sendCombinedStatsEmail(stats, allLabels);
    } else {
      emailManager.sendContactStatsEmail(stats);
      emailManager.sendLabelStatsEmail(stats, allLabels);
    }
    
    Logger.log('Sent comprehensive statistics report');
  } catch (error) {
    Logger.log(`Error in sendStatisticsReport: ${error.message}`);
    throw error;
  }
}

/**
 * Sends some reports in one batch
 * @throws {Error} When any report fails
 */
function sendAllQuickReports() {
  try {
    Logger.log('Starting all quick win reports...');
    
    const reports = [
      () => sendMissingFieldReport('email'),
      () => sendMissingFieldReport('phone'), 
      () => sendContactsWithoutSurnamesReport(),
      () => sendLabelUsageReport(),
      () => sendContactsByCityReport(),
      () => sendDuplicateContactsReport()
    ];
    
    let successful = 0;
    let failed = 0;
    
    reports.forEach((reportFn, index) => {
      try {
        reportFn();
        successful++;
      } catch (error) {
        failed++;
        Logger.log(`Report ${index + 1} failed: ${error.message}`);
      }
    });
    
    Logger.log(`Quick reports completed: ${successful} successful, ${failed} failed`);
  } catch (error) {
    Logger.log(`Error in sendAllQuickReports: ${error.message}`);
    throw error;
  }
}

/**
 * Tests contact fetching and logging functionality
 * @param {string[]} [labelFilter=[]] - Optional labels to filter by
 * @throws {Error} When contact operations fail
 */
function testContacts(labelFilter = []) {
  try {
    const contactManager = new ContactManager();
    contactManager.logAllContacts();
    Logger.log(`Contact test completed - ${contactManager.contacts.length} contacts found`);
  } catch (error) {
    Logger.log(`Error in testContacts: ${error.message}`);
    throw error;
  }
}

/**
 * Tests label fetching and logging functionality
 * @throws {Error} When label operations fail
 */
function testLabels() {
  try {
    const labelManager = new LabelManager();
    labelManager.logAllLabels();
    Logger.log(`Label test completed - ${labelManager.labels.length} labels found`);
  } catch (error) {
    Logger.log(`Error in testLabels: ${error.message}`);
    throw error;
  }
}

/**
 * Runs all available test functions with error handling
 * @throws {Error} When any test fails
 */
function runAllTests() {
  const testResults = { passed: 0, failed: 0, errors: [] };
  
  // Test Contact Manager
  try {
    Logger.log('Running Contact Manager Tests...');
    Logger.log('================================');
    if (typeof runContactManagerTests === 'function') {
      runContactManagerTests();
    } else {
      testContacts();
    }
    testResults.passed++;
  } catch (error) {
    testResults.failed++;
    testResults.errors.push(`Contact Manager: ${error.message}`);
    Logger.log(`Contact Manager tests failed: ${error.message}`);
  }
  
  // Test Label Manager
  try {
    Logger.log('\nRunning Label Manager Tests...');
    Logger.log('================================');
    if (typeof runLabelManagerTests === 'function') {
      runLabelManagerTests();
    } else {
      testLabels();
    }
    testResults.passed++;
  } catch (error) {
    testResults.failed++;
    testResults.errors.push(`Label Manager: ${error.message}`);
    Logger.log(`Label Manager tests failed: ${error.message}`);
  }
  
  // Test Email Manager
  try {
    Logger.log('\nRunning Email Manager Tests...');
    Logger.log('================================');
    if (typeof runEmailManagerTests === 'function') {
      runEmailManagerTests();
      testResults.passed++;
    } else {
      Logger.log('Email Manager tests not available - skipping');
    }
  } catch (error) {
    testResults.failed++;
    testResults.errors.push(`Email Manager: ${error.message}`);
    Logger.log(`Email Manager tests failed: ${error.message}`);
  }
  
  Logger.log(`\nTest Results: ${testResults.passed} passed, ${testResults.failed} failed`);
  if (testResults.failed > 0) {
    Logger.log('Errors:');
    testResults.errors.forEach(error => Logger.log(`- ${error}`));
    throw new Error(`${testResults.failed} test(s) failed`);
  }
}

/**
 * Sends email report of contacts missing specific field
 * @param {string} field - Field to check ('email', 'phone', 'city', 'birthday')
 * @throws {Error} When field is invalid or operation fails
 */
function sendMissingFieldReport(field) {
  try {
    const validFields = ['email', 'phone', 'city', 'birthday'];
    if (!validFields.includes(field)) {
      throw new Error(`Invalid field. Must be one of: ${validFields.join(', ')}`);
    }

    const contactManager = new ContactManager();
    const emailManager = new EmailManager();
    const contacts = contactManager.findContactsMissingField(field);
    
    if (contacts.length === 0) {
      Logger.log(`No contacts missing ${field} found`);
      return;
    }
    
    emailManager.sendMissingFieldEmail(field, contacts);
    Logger.log(`Sent missing ${field} report (${contacts.length} contacts found)`);
  } catch (error) {
    Logger.log(`Error in sendMissingFieldReport: ${error.message}`);
    throw error;
  }
}

/**
 * Sends label usage statistics report
 * @throws {Error} When operation fails
 */
function sendLabelUsageReport() {
  try {
    const contactManager = new ContactManager();
    const emailManager = new EmailManager();
    const labelStats = contactManager.getLabelUsageStats();
    
    emailManager.sendLabelUsageStatsEmail(labelStats);
    Logger.log(`Sent label usage statistics report`);
  } catch (error) {
    Logger.log(`Error in sendLabelUsageReport: ${error.message}`);
    throw error;
  }
}

/**
 * Sends contacts grouped by city report
 * @throws {Error} When operation fails
 */
function sendContactsByCityReport() {
  try {
    const contactManager = new ContactManager();
    const emailManager = new EmailManager();
    const cityGroups = contactManager.getContactsByCity();
    
    if (cityGroups.length === 0) {
      Logger.log('No city data found');
      return;
    }
    
    emailManager.sendContactsByCityEmail(cityGroups);
    Logger.log(`Sent contacts by city report (${cityGroups.length} cities)`);
  } catch (error) {
    Logger.log(`Error in sendContactsByCityReport: ${error.message}`);
    throw error;
  }
}

/**
 * Sends potential duplicate contacts report
 * @throws {Error} When operation fails
 */
function sendDuplicateContactsReport() {
  try {
    const contactManager = new ContactManager();
    const emailManager = new EmailManager();
    const duplicates = contactManager.findPotentialDuplicates();
    
    if (duplicates.length === 0) {
      Logger.log('No potential duplicates found');
      return;
    }
    
    emailManager.sendDuplicatesEmail(duplicates);
    Logger.log(`Sent duplicate contacts report (${duplicates.length} groups found)`);
  } catch (error) {
    Logger.log(`Error in sendDuplicateContactsReport: ${error.message}`);
    throw error;
  }
}


/**
 * Gets application health status and basic metrics
 * @returns {Object} Health status information
 */
function getHealthStatus() {
  try {
    const startTime = Date.now();
    const contactManager = new ContactManager();
    const labelManager = new LabelManager();
    const endTime = Date.now();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: endTime - startTime,
      contactCount: contactManager.contacts.length,
      labelCount: labelManager.labels.length
    };
  } catch (error) {
    Logger.log(`Health check failed: ${error.message}`);
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}