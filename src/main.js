/**
 * @fileoverview Report entry points.
 *
 * Each function here is a top-level report that can be:
 * - Run manually from the Apps Script editor dropdown
 * - Triggered on a schedule via setupSchedules()
 * - Called from sendAllReports() for batch execution
 *
 * Flow: fetch contacts → filter → prepare (exclude/sort/limit) → send email
 */


// ═══════════════════════════════════════════════════════════════════════════════
// Report functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sends the Upcoming Birthdays report.
 * Lists contacts with birthdays in the next N days.
 * @param {number} [days] Number of days to look ahead (defaults to config)
 */
function sendUpcomingBirthdaysReport(days) {
  try {
    if (!isLabelFilterConfigured()) return;
    const isDryRun = typeof dryRun !== 'undefined' && dryRun;
    const lookAhead = days || (typeof upcomingBirthdaysDays !== 'undefined' ? upcomingBirthdaysDays : 7);

    if (typeof lookAhead !== 'number' || lookAhead < 1 || lookAhead > 365) {
      throw new Error('Days parameter must be a number between 1 and 365');
    }

    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const upcoming = prepareContacts(findUpcomingBirthdays(contacts, lookAhead));

    if (upcoming.length === 0) {
      Logger.log(`No upcoming birthdays in the next ${lookAhead} days`);
      return;
    }

    if (isDryRun) {
      Logger.log(`🧪 [DRY RUN] Would send Upcoming Birthdays report (${upcoming.length} contacts, ${lookAhead} days)`);
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendUpcomingBirthdaysEmail(upcoming, lookAhead);
    Logger.log(`✅ Sent Upcoming Birthdays report (${upcoming.length} contacts)`);
  } catch (error) {
    Logger.log(`Error in sendUpcomingBirthdaysReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends the Duplicate Contacts report.
 * Finds groups of contacts that may be duplicates based on configured match fields.
 */
function sendDuplicateContactsReport() {
  try {
    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const matchFields = typeof duplicateMatchFields !== 'undefined' ? duplicateMatchFields : ['name', 'email', 'phone'];
    const duplicates = findDuplicates(contacts, matchFields);

    if (duplicates.length === 0) {
      Logger.log('No potential duplicates found');
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendDuplicateContactsEmail(duplicates);
    Logger.log(`✅ Sent Duplicate Contacts report (${duplicates.length} groups)`);
  } catch (error) {
    Logger.log(`Error in sendDuplicateContactsReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends the Contact Overview report.
 * Shows general statistics about your contacts (completeness percentages).
 */
function sendContactOverviewReport() {
  try {
    if (!isLabelFilterConfigured()) return;
    const isDryRun = typeof dryRun !== 'undefined' && dryRun;

    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const stats = computeContactStats(contacts);

    if (isDryRun) {
      Logger.log(`🧪 [DRY RUN] Would send Contact Overview report (${stats.totalContacts} contacts)`);
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendContactOverviewEmail(stats);
    Logger.log(`✅ Sent Contact Overview report (${stats.totalContacts} contacts)`);
  } catch (error) {
    Logger.log(`Error in sendContactOverviewReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends the Label Overview report.
 * Combines label usage stats, distribution, and unlabeled contacts in one email.
 */
function sendLabelOverviewReport() {
  try {
    if (!isLabelFilterConfigured()) return;
    const isDryRun = typeof dryRun !== 'undefined' && dryRun;

    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const labelStats = computeLabelStats(contacts);
    const unlabeled = prepareContacts(findUnlabeled(contacts));
    const stats = computeContactStats(contacts);

    if (isDryRun) {
      Logger.log(`🧪 [DRY RUN] Would send Label Overview report (${labelStats.totalLabels} labels, ${unlabeled.length} unlabeled)`);
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendLabelOverviewEmail(labelStats, unlabeled, stats.labelDistribution, stats.totalContacts);
    Logger.log(`✅ Sent Label Overview report (${labelStats.totalLabels} labels, ${unlabeled.length} unlabeled)`);
  } catch (error) {
    Logger.log(`Error in sendLabelOverviewReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends the Missing Info report for a specific field.
 * Lists contacts that are missing email, phone, city, or birthday.
 * @param {string} field Field to check ('email', 'phone', 'city', 'birthday')
 */
function sendMissingInfoReport(field) {
  try {
    const validFields = ['email', 'phone', 'city', 'birthday'];
    if (!validFields.includes(field)) {
      throw new Error(`Invalid field. Must be one of: ${validFields.join(', ')}`);
    }

    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const missing = prepareContacts(findMissingField(contacts, field));

    if (missing.length === 0) {
      Logger.log(`No contacts missing ${field} found`);
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendMissingInfoEmail(field, missing);
    Logger.log(`✅ Sent Missing Info report for ${field} (${missing.length} contacts)`);
  } catch (error) {
    Logger.log(`Error in sendMissingInfoReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends the Data Quality report.
 * Combines contacts without surnames and contacts with invalid phone numbers.
 */
function sendDataQualityReport() {
  try {
    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const noSurname = prepareContacts(findMissingSurnames(contacts));
    const invalidPhones = prepareContacts(findInvalidPhones(contacts));

    if (noSurname.length === 0 && invalidPhones.length === 0) {
      Logger.log('No data quality issues found');
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendDataQualityEmail(noSurname, invalidPhones);
    Logger.log(`✅ Sent Data Quality report (${noSurname.length} missing surnames, ${invalidPhones.length} invalid phones)`);
  } catch (error) {
    Logger.log(`Error in sendDataQualityReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends Missing Info reports for all configured fields.
 * Used as a trigger target since triggers can't pass parameters.
 */
function sendMissingInfoReportAll() {
  const fields = typeof missingInfoFields !== 'undefined' ? missingInfoFields : ['email', 'phone', 'birthday'];
  fields.forEach(field => {
    try {
      sendMissingInfoReport(field);
    } catch (error) {
      Logger.log(`Missing Info (${field}) failed: ${error.message}`);
    }
  });
}


/**
 * Sends all enabled reports in one batch.
 * Useful for manual "run everything now" from the editor.
 * Respects enabledReports and missingInfoFields config.
 */
function sendAllReports() {
  try {
    Logger.log('Starting all reports...');

    const fields = typeof missingInfoFields !== 'undefined' ? missingInfoFields : ['email', 'phone', 'birthday'];

    const reports = [];

    if (isReportEnabled('upcomingBirthdays')) reports.push(() => sendUpcomingBirthdaysReport());
    if (isReportEnabled('duplicates'))        reports.push(() => sendDuplicateContactsReport());
    if (isReportEnabled('contactOverview'))    reports.push(() => sendContactOverviewReport());
    if (isReportEnabled('labelOverview'))      reports.push(() => sendLabelOverviewReport());
    if (isReportEnabled('missingInfo')) {
      fields.forEach(field => reports.push(() => sendMissingInfoReport(field)));
    }
    if (isReportEnabled('dataQuality'))        reports.push(() => sendDataQualityReport());

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

    Logger.log(`All reports completed: ${successful} successful, ${failed} failed`);
  } catch (error) {
    Logger.log(`Error in sendAllReports: ${error.message}`);
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
