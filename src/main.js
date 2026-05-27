/**
 * @fileoverview Google Contacts Scripts — Main entry points for contact reports.
 */


/**
 * Sends an email report of all contacts that don't have any labels assigned.
 */
function sendUnlabeledContactsReport() {
  try {
    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const unlabeled = findContactsWithoutLabels(contacts);

    if (unlabeled.length === 0) {
      Logger.log('No unlabeled contacts found');
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendUnlabeledContactsEmail(unlabeled);
    Logger.log(`Sent unlabeled contacts report (${unlabeled.length} contacts)`);
  } catch (error) {
    Logger.log(`Error in sendUnlabeledContactsReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends an email report of all contacts that don't have a birthday set.
 */
function sendContactsWithoutBirthdayReport() {
  try {
    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const missing = findContactsWithoutBirthday(contacts);

    if (missing.length === 0) {
      Logger.log('No contacts without birthday found');
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendContactsWithoutBirthdayEmail(missing);
    Logger.log(`Sent contacts without birthday report (${missing.length} contacts)`);
  } catch (error) {
    Logger.log(`Error in sendContactsWithoutBirthdayReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends an email report of all contacts that have a specific label.
 * @param {string} label The label to filter contacts by
 */
function sendContactsWithLabelReport(label) {
  try {
    if (!label || typeof label !== 'string' || !label.trim()) {
      throw new Error('Label parameter is required and must be a non-empty string');
    }

    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const labeled = findContactsWithLabel(contacts, label.trim());

    if (labeled.length === 0) {
      Logger.log(`No contacts found with label "${label}"`);
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendContactsWithLabelEmail(label, labeled);
    Logger.log(`Sent contacts with label "${label}" report (${labeled.length} contacts)`);
  } catch (error) {
    Logger.log(`Error in sendContactsWithLabelReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends an email report of contacts with upcoming birthdays.
 * @param {number} [days] Number of days to look ahead (defaults to config)
 */
function sendUpcomingBirthdaysReport(days) {
  try {
    const lookAhead = days || (typeof upcomingBirthdaysDays !== 'undefined' ? upcomingBirthdaysDays : 7);

    if (typeof lookAhead !== 'number' || lookAhead < 1 || lookAhead > 365) {
      throw new Error('Days parameter must be a number between 1 and 365');
    }

    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const upcoming = findContactsWithUpcomingBirthdays(contacts, lookAhead);

    if (upcoming.length === 0) {
      Logger.log(`No upcoming birthdays in the next ${lookAhead} days`);
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendUpcomingBirthdaysEmail(upcoming, lookAhead);
    Logger.log(`Sent upcoming birthdays report (${upcoming.length} contacts)`);
  } catch (error) {
    Logger.log(`Error in sendUpcomingBirthdaysReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends an email report of contacts without surnames.
 */
function sendContactsWithoutSurnamesReport() {
  try {
    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const missing = findContactsWithoutSurnames(contacts);

    if (missing.length === 0) {
      Logger.log('No contacts without surnames found');
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendContactsWithoutSurnamesEmail(missing);
    Logger.log(`Sent contacts without surnames report (${missing.length} contacts)`);
  } catch (error) {
    Logger.log(`Error in sendContactsWithoutSurnamesReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends an email report of contacts with potentially invalid phone numbers.
 */
function sendInvalidPhonesReport() {
  try {
    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const invalid = findContactsWithInvalidPhones(contacts);

    if (invalid.length === 0) {
      Logger.log('No contacts with invalid phone numbers found');
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendInvalidPhonesEmail(invalid);
    Logger.log(`Sent invalid phone numbers report (${invalid.length} contacts)`);
  } catch (error) {
    Logger.log(`Error in sendInvalidPhonesReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends a comprehensive statistics report.
 */
function sendStatisticsReport() {
  try {
    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const labelManager = new LabelManager();
    const emailManager = new EmailManager();

    const stats = generateContactStats(contacts);
    const allLabels = labelManager.fetchLabels();

    emailManager.sendContactStatsEmail(stats);
    emailManager.sendLabelStatsEmail(stats, allLabels);
    Logger.log('Sent comprehensive statistics report');
  } catch (error) {
    Logger.log(`Error in sendStatisticsReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends email report of contacts missing a specific field.
 * @param {string} field Field to check ('email', 'phone', 'city', 'birthday')
 */
function sendMissingFieldReport(field) {
  try {
    const validFields = ['email', 'phone', 'city', 'birthday'];
    if (!validFields.includes(field)) {
      throw new Error(`Invalid field. Must be one of: ${validFields.join(', ')}`);
    }

    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const missing = findContactsMissingField(contacts, field);

    if (missing.length === 0) {
      Logger.log(`No contacts missing ${field} found`);
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendMissingFieldEmail(field, missing);
    Logger.log(`Sent missing ${field} report (${missing.length} contacts)`);
  } catch (error) {
    Logger.log(`Error in sendMissingFieldReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends label usage statistics report.
 */
function sendLabelUsageReport() {
  try {
    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const labelStats = getLabelUsageStats(contacts);

    const emailManager = new EmailManager();
    emailManager.sendLabelUsageStatsEmail(labelStats);
    Logger.log('Sent label usage statistics report');
  } catch (error) {
    Logger.log(`Error in sendLabelUsageReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends contacts grouped by city report.
 */
function sendContactsByCityReport() {
  try {
    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const cityGroups = getContactsByCity(contacts);

    if (cityGroups.length === 0) {
      Logger.log('No city data found');
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendContactsByCityEmail(cityGroups);
    Logger.log(`Sent contacts by city report (${cityGroups.length} cities)`);
  } catch (error) {
    Logger.log(`Error in sendContactsByCityReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends potential duplicate contacts report.
 */
function sendDuplicateContactsReport() {
  try {
    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const duplicates = findPotentialDuplicates(contacts);

    if (duplicates.length === 0) {
      Logger.log('No potential duplicates found');
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendDuplicatesEmail(duplicates);
    Logger.log(`Sent duplicate contacts report (${duplicates.length} groups)`);
  } catch (error) {
    Logger.log(`Error in sendDuplicateContactsReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends all quick reports in one batch.
 */
function sendAllQuickReports() {
  try {
    Logger.log('Starting all quick reports...');

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


// ═══════════════════════════════════════════════════════════════════════════════
// Test / debug helpers
// ═══════════════════════════════════════════════════════════════════════════════


/**
 * Tests contact fetching and logs all contact names.
 */
function testContacts() {
  try {
    const contacts = fetchContacts(useLabel ? labelFilter : []);
    logContactNames(contacts);
    Logger.log(`Contact test completed — ${contacts.length} contacts found`);
  } catch (error) {
    Logger.log(`Error in testContacts: ${error.message}`);
    throw error;
  }
}


/**
 * Tests label fetching and logs all labels.
 */
function testLabels() {
  try {
    const labelManager = new LabelManager();
    labelManager.logAllLabels();
    Logger.log(`Label test completed — ${labelManager.labels.length} labels found`);
  } catch (error) {
    Logger.log(`Error in testLabels: ${error.message}`);
    throw error;
  }
}


/**
 * Gets application health status and basic metrics.
 * @returns {Object} Health status information
 */
function getHealthStatus() {
  try {
    const startTime = Date.now();
    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const labelManager = new LabelManager();
    const endTime = Date.now();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: endTime - startTime,
      contactCount: contacts.length,
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
