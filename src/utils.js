/**
 * Utility functions — pure helpers and config management.
 */


// ═══════════════════════════════════════════════════════════════════════════════
// Config validation & helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates the configuration and logs warnings for invalid values.
 * Call this once at setup or before running reports.
 * @returns {string[]} Array of validation error messages (empty = all good)
 */
function validateConfig() {
  const errors = [];

  // Label filter
  if (typeof useLabel !== 'boolean') {
    errors.push('useLabel must be a boolean (true/false)');
  }
  if (useLabel && (!Array.isArray(labelFilter) || labelFilter.length === 0)) {
    errors.push('useLabel is true but labelFilter is empty — no contacts will match');
  }
  if (Array.isArray(labelFilter) && labelFilter.some(l => typeof l !== 'string')) {
    errors.push('labelFilter must only contain strings');
  }

  // Exclude labels
  if (typeof excludeLabels !== 'undefined' && !Array.isArray(excludeLabels)) {
    errors.push('excludeLabels must be an array of strings');
  }

  // Upcoming birthdays
  if (typeof upcomingBirthdaysDays !== 'undefined') {
    if (typeof upcomingBirthdaysDays !== 'number' || upcomingBirthdaysDays < 1 || upcomingBirthdaysDays > 365) {
      errors.push('upcomingBirthdaysDays must be a number between 1 and 365');
    }
  }

  // Birthday format
  const validFormats = ['dd.MM.', 'dd/MM', 'MM/dd', 'dd MMM', 'MMM dd'];
  if (typeof birthdayFormat !== 'undefined' && !validFormats.includes(birthdayFormat)) {
    errors.push(`birthdayFormat must be one of: ${validFormats.join(', ')}`);
  }

  // Sort
  const validSorts = ['name', 'name-desc', 'labels', 'city'];
  if (typeof sortContactsBy !== 'undefined' && !validSorts.includes(sortContactsBy)) {
    errors.push(`sortContactsBy must be one of: ${validSorts.join(', ')}`);
  }

  // Max contacts
  if (typeof maxContactsPerReport !== 'undefined') {
    if (typeof maxContactsPerReport !== 'number' || maxContactsPerReport < 0) {
      errors.push('maxContactsPerReport must be a number >= 0');
    }
  }

  // Enabled reports
  if (typeof enabledReports !== 'undefined') {
    const validKeys = ['upcomingBirthdays', 'duplicates', 'contactOverview', 'labelOverview', 'missingInfo', 'dataQuality'];
    Object.keys(enabledReports).forEach(key => {
      if (!validKeys.includes(key)) errors.push(`enabledReports: unknown report "${key}"`);
    });
  }

  // Missing info fields
  if (typeof missingInfoFields !== 'undefined') {
    const validFields = ['email', 'phone', 'city', 'birthday'];
    if (!Array.isArray(missingInfoFields)) {
      errors.push('missingInfoFields must be an array');
    } else {
      missingInfoFields.forEach(f => {
        if (!validFields.includes(f)) errors.push(`missingInfoFields: invalid field "${f}"`);
      });
    }
  }

  // Duplicate match fields
  if (typeof duplicateMatchFields !== 'undefined') {
    const validDupFields = ['name', 'email', 'phone'];
    if (!Array.isArray(duplicateMatchFields)) {
      errors.push('duplicateMatchFields must be an array');
    } else {
      duplicateMatchFields.forEach(f => {
        if (!validDupFields.includes(f)) errors.push(`duplicateMatchFields: invalid field "${f}"`);
      });
    }
  }

  // Schedule hour
  if (typeof scheduleHour !== 'undefined') {
    if (typeof scheduleHour !== 'number' || scheduleHour < 0 || scheduleHour > 23) {
      errors.push('scheduleHour must be a number between 0 and 23');
    }
  }

  // Monthly report day
  if (typeof monthlyReportDay !== 'undefined') {
    if (typeof monthlyReportDay !== 'number' || monthlyReportDay < 1 || monthlyReportDay > 28) {
      errors.push('monthlyReportDay must be a number between 1 and 28');
    }
  }

  // Log results
  if (errors.length > 0) {
    Logger.log('⚠️ Config validation issues:');
    errors.forEach(e => Logger.log(`   • ${e}`));
  } else {
    Logger.log('✅ Config is valid');
  }

  return errors;
}


/**
 * Checks whether label filtering is correctly configured.
 * @returns {boolean} true if valid, false if misconfigured
 */
function isLabelFilterConfigured() {
  if (useLabel && (!labelFilter || labelFilter.length === 0)) {
    Logger.log('⚠️ useLabel is enabled but labelFilter is empty — no contacts will match.');
    Logger.log('   Add label names to labelFilter in config.js, or set useLabel to false.');
    return false;
  }
  return true;
}


/**
 * Checks if a specific report is enabled in config.
 * @param {string} reportName Key in enabledReports
 * @returns {boolean}
 */
function isReportEnabled(reportName) {
  if (typeof enabledReports === 'undefined') return true;
  return enabledReports[reportName] !== false;
}


// ═══════════════════════════════════════════════════════════════════════════════
// Contact list processing
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Trims a contact list to the configured max, if set.
 * @param {Contact[]} contacts
 * @returns {Contact[]}
 */
function applyLimit(contacts) {
  const max = typeof maxContactsPerReport !== 'undefined' ? maxContactsPerReport : 0;
  if (max > 0 && contacts.length > max) {
    return contacts.slice(0, max);
  }
  return contacts;
}


/**
 * Sorts a contact list based on the sortContactsBy config.
 * @param {Contact[]} contacts
 * @returns {Contact[]}
 */
function applySorting(contacts) {
  const sortBy = typeof sortContactsBy !== 'undefined' ? sortContactsBy : 'name';
  const sorted = [...contacts];

  switch (sortBy) {
    case 'name':
      sorted.sort((a, b) => a.getName().localeCompare(b.getName()));
      break;
    case 'name-desc':
      sorted.sort((a, b) => b.getName().localeCompare(a.getName()));
      break;
    case 'labels':
      sorted.sort((a, b) => b.getLabels().length - a.getLabels().length);
      break;
    case 'city':
      sorted.sort((a, b) => (a.city || '').localeCompare(b.city || ''));
      break;
    default:
      sorted.sort((a, b) => a.getName().localeCompare(b.getName()));
  }

  return sorted;
}


/**
 * Filters out contacts that have any of the excluded labels.
 * @param {Contact[]} contacts
 * @returns {Contact[]}
 */
function applyExcludeLabels(contacts) {
  const excluded = typeof excludeLabels !== 'undefined' ? excludeLabels : [];
  if (!Array.isArray(excluded) || excluded.length === 0) return contacts;
  return contacts.filter(c => !c.getLabels().some(l => excluded.includes(l)));
}


/**
 * Applies standard post-processing: exclude labels, sort, limit.
 * @param {Contact[]} contacts
 * @returns {Contact[]}
 */
function prepareContacts(contacts) {
  return applyLimit(applySorting(applyExcludeLabels(contacts)));
}


// ═══════════════════════════════════════════════════════════════════════════════
// General utilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extracts Instagram usernames from the given notes.
 * Supports @username patterns and "Instagram: username" format.
 *
 * @param {string} notes The notes containing Instagram usernames.
 * @returns {string[]} Array of Instagram usernames (with @ prefix), or empty array if none found.
 */
function extractInstagramNamesFromNotes(notes) {
  if (!notes) return [];

  const instagramNames = [];

  // Match all @username patterns in the notes
  const atMatches = notes.match(/@[\w.]+/g);
  if (atMatches) {
    atMatches.forEach(match => {
      const username = match.startsWith('@') ? match : '@' + match;
      if (!instagramNames.includes(username)) {
        instagramNames.push(username);
      }
    });
  }

  // Also match "Instagram: username" pattern (without @)
  const instaPattern = /Instagram:\s*([^\s,@][^\s,]*)/gi;
  let match;
  while ((match = instaPattern.exec(notes)) !== null) {
    const username = '@' + match[1].trim();
    if (!instagramNames.includes(username)) {
      instagramNames.push(username);
    }
  }

  return instagramNames;
}
