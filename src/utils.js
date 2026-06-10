/**
 * Utility functions — pure helpers and config management.
 */


// ═══════════════════════════════════════════════════════════════════════════════
// Config validation & helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Gets a value from the new config structure with fallback to legacy globals.
 * @param {string} path Dot-separated path (e.g. 'generalConfig.sortContactsBy')
 * @param {*} fallback Default value if not found
 * @returns {*}
 */
function getConfig(path, fallback) {
  const parts = path.split('.');
  let obj;
  try {
    obj = eval(parts[0]);
  } catch (e) {
    return fallback;
  }
  if (obj === undefined) return fallback;
  for (let i = 1; i < parts.length; i++) {
    if (obj === null || obj === undefined) return fallback;
    obj = obj[parts[i]];
  }
  return obj !== undefined ? obj : fallback;
}

// ─── Convenience accessors for common config values ───────────────────────────

function cfg() {
  return typeof generalConfig !== 'undefined' ? generalConfig : {};
}

function reportCfg(name) {
  return (typeof reports !== 'undefined' && reports[name]) ? reports[name] : {};
}

function actionCfg(name) {
  return (typeof actions !== 'undefined' && actions[name]) ? actions[name] : {};
}

/**
 * Validates the configuration and logs warnings for invalid values.
 * Call this once at setup or before running reports.
 * @returns {string[]} Array of validation error messages (empty = all good)
 */
function validateConfig() {
  const errors = [];
  const c = cfg();
  const r = typeof reports !== 'undefined' ? reports : {};
  const a = typeof actions !== 'undefined' ? actions : {};

  // ─── General config ─────────────────────────────────────────────────────────
  if (typeof c.useLabel !== 'boolean') {
    errors.push('generalConfig.useLabel must be a boolean');
  }
  if (c.useLabel && (!Array.isArray(c.labelFilter) || c.labelFilter.length === 0)) {
    errors.push('useLabel is true but labelFilter is empty — no contacts will match');
  }
  if (c.labelFilter && !Array.isArray(c.labelFilter)) {
    errors.push('generalConfig.labelFilter must be an array');
  }
  if (c.excludeLabels && !Array.isArray(c.excludeLabels)) {
    errors.push('generalConfig.excludeLabels must be an array');
  }

  const validFormats = ['dd.MM.', 'dd/MM', 'MM/dd', 'dd MMM', 'MMM dd'];
  if (c.birthdayFormat && !validFormats.includes(c.birthdayFormat)) {
    errors.push(`generalConfig.birthdayFormat must be one of: ${validFormats.join(', ')}`);
  }

  const validSorts = ['name', 'name-desc', 'labels', 'city'];
  if (c.sortContactsBy && !validSorts.includes(c.sortContactsBy)) {
    errors.push(`generalConfig.sortContactsBy must be one of: ${validSorts.join(', ')}`);
  }

  if (c.maxContactsPerReport !== undefined && (typeof c.maxContactsPerReport !== 'number' || c.maxContactsPerReport < 0)) {
    errors.push('generalConfig.maxContactsPerReport must be a number >= 0');
  }

  // ─── Reports ────────────────────────────────────────────────────────────────
  const validSchedules = ['daily', 'weekly', 'monthly', 'off'];
  const validReportKeys = ['upcomingBirthdays', 'duplicates', 'contactOverview', 'labelOverview', 'missingInfo', 'dataQuality'];

  validReportKeys.forEach(key => {
    const report = r[key];
    if (!report) return;
    if (report.schedule && !validSchedules.includes(report.schedule)) {
      errors.push(`reports.${key}.schedule must be one of: ${validSchedules.join(', ')}`);
    }
    if (report.day !== undefined && (typeof report.day !== 'number' || report.day < 1 || report.day > 28)) {
      errors.push(`reports.${key}.day must be a number 1–28`);
    }
  });

  // Upcoming birthdays specific
  const ub = r.upcomingBirthdays;
  if (ub && ub.aheadDays !== undefined) {
    if (typeof ub.aheadDays !== 'number' || ub.aheadDays < 1 || ub.aheadDays > 365) {
      errors.push('reports.upcomingBirthdays.aheadDays must be 1–365');
    }
  }

  // Missing info fields
  const mi = r.missingInfo;
  if (mi && mi.fields) {
    const validFields = ['email', 'phone', 'city', 'birthday'];
    mi.fields.forEach(f => {
      if (!validFields.includes(f)) errors.push(`reports.missingInfo.fields: invalid field "${f}"`);
    });
  }

  // Duplicates match fields
  const dup = r.duplicates;
  if (dup && dup.matchFields) {
    const validDupFields = ['name', 'email', 'phone'];
    dup.matchFields.forEach(f => {
      if (!validDupFields.includes(f)) errors.push(`reports.duplicates.matchFields: invalid field "${f}"`);
    });
  }

  // ─── Actions ────────────────────────────────────────────────────────────────
  const validActionKeys = ['autoLabeling', 'nameFormatter', 'phoneNormalizer', 'instagramToWebsite', 'messengerToWebsite'];

  validActionKeys.forEach(key => {
    const action = a[key];
    if (!action) return;
    if (action.schedule && !validSchedules.includes(action.schedule)) {
      errors.push(`actions.${key}.schedule must be one of: ${validSchedules.join(', ')}`);
    }
    if (action.day !== undefined && (typeof action.day !== 'number' || action.day < 1 || action.day > 28)) {
      errors.push(`actions.${key}.day must be a number 1–28`);
    }
    if (action.dryRun !== undefined && typeof action.dryRun !== 'boolean') {
      errors.push(`actions.${key}.dryRun must be a boolean`);
    }
  });

  // Auto-labeling rules
  const al = a.autoLabeling;
  if (al && al.rules) {
    if (!Array.isArray(al.rules)) {
      errors.push('actions.autoLabeling.rules must be an array');
    } else {
      al.rules.forEach((rule, i) => {
        if (!rule.field || !rule.label) {
          errors.push(`actions.autoLabeling.rules[${i}]: must have field and label`);
        }
      });
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
  const c = cfg();
  if (c.useLabel && (!c.labelFilter || c.labelFilter.length === 0)) {
    Logger.log('⚠️ useLabel is enabled but labelFilter is empty — no contacts will match.');
    Logger.log('   Add label names to labelFilter in config, or set useLabel to false.');
    return false;
  }
  return true;
}


/**
 * Checks if a specific report is enabled (has a schedule that isn't 'off').
 * @param {string} reportName Key in reports config
 * @returns {boolean}
 */
function isReportEnabled(reportName) {
  const r = reportCfg(reportName);
  return !!(r.schedule && r.schedule !== 'off');
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
  const max = cfg().maxContactsPerReport || 0;
  if (max > 0 && contacts.length > max) {
    const limited = contacts.slice(0, max);
    limited._totalBeforeLimit = contacts.length;
    return limited;
  }
  return contacts;
}


/**
 * Sorts a contact list based on the sortContactsBy config.
 * @param {Contact[]} contacts
 * @returns {Contact[]}
 */
function applySorting(contacts) {
  const sortBy = cfg().sortContactsBy || 'name';
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
  const excluded = cfg().excludeLabels || [];
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
 * Excludes email addresses and strips trailing punctuation.
 *
 * @param {string} notes The notes containing Instagram usernames.
 * @returns {string[]} Array of Instagram usernames (with @ prefix), or empty array if none found.
 */
function extractInstagramNamesFromNotes(notes) {
  if (!notes) return [];

  const instagramNames = [];

  // Match @username patterns that are NOT preceded by a word character (excludes emails)
  const atMatches = notes.match(/(?<![a-zA-Z0-9])@[\w.]+/g);
  if (atMatches) {
    atMatches.forEach(match => {
      // Strip trailing dots/punctuation from the username
      const username = match.replace(/[.]+$/, '');
      if (username.length > 1 && !instagramNames.includes(username)) {
        instagramNames.push(username);
      }
    });
  }

  // Also match "Instagram: username" pattern (without @)
  const instaPattern = /Instagram:\s*([a-zA-Z0-9_.]+)/gi;
  let match;
  while ((match = instaPattern.exec(notes)) !== null) {
    const username = '@' + match[1].replace(/[.]+$/, '');
    if (!instagramNames.includes(username)) {
      instagramNames.push(username);
    }
  }

  return instagramNames;
}


/**
 * Extracts Instagram usernames from website URL objects.
 * Matches URLs where the domain is instagram.com.
 *
 * @param {Object[]} urls Array of URL objects from People API ({ value, type, formattedType })
 * @returns {string[]} Array of Instagram usernames (with @ prefix), or empty array if none found.
 */
function extractInstagramNamesFromUrls(urls) {
  if (!urls || !Array.isArray(urls)) return [];

  const instagramNames = [];
  const pattern = /^https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/i;

  urls.forEach(urlObj => {
    const url = urlObj.value || '';
    const match = url.match(pattern);
    if (match) {
      const username = '@' + match[2];
      if (!instagramNames.includes(username)) {
        instagramNames.push(username);
      }
    }
  });

  return instagramNames;
}


/**
 * Deduplicates Instagram usernames (case-insensitive).
 *
 * @param {string[]} names Array of Instagram usernames (with @ prefix)
 * @returns {string[]} Deduplicated array
 */
function deduplicateInstagramNames(names) {
  const seen = new Set();
  return names.filter(name => {
    const lower = name.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}
