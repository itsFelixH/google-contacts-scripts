/**
 * @fileoverview Contact fetching, filtering, and analysis.
 *
 * This file handles:
 * - Fetching contacts from the Google People API (with pagination and retries)
 * - Filtering contacts by various criteria (labels, fields, duplicates)
 * - Computing statistics about a contact collection
 */


// ═══════════════════════════════════════════════════════════════════════════════
// API — Fetching contacts from Google
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetches all contacts from Google Contacts, optionally filtering by labels.
 * Handles pagination automatically and retries on transient API errors.
 *
 * @param {string[]} [labelNames=[]] Only include contacts with these labels (empty = all)
 * @param {number} [maxRetries=3] Max API retry attempts per page
 * @returns {Contact[]} Array of Contact objects
 */
function fetchContacts(labelNames = [], maxRetries = 3) {
  try {
    validateLabelFilter(labelNames);
    const labelManager = new LabelManager();
    const contacts = [];
    let pageToken = null;
    let attempt = 0;

    // API settings (hardcoded — no need to configure these)
    const pageSize = 100;
    const personFields = 'names,birthdays,memberships,emailAddresses,phoneNumbers,addresses,biographies,urls';
    const retries = maxRetries;

    if (labelNames.length === 0) {
      Logger.log('🔍 Fetching all contacts...');
    } else {
      Logger.log(`🔍 Fetching contacts with label(s): '${labelNames.join(', ')}'...`);
    }

    // Paginate through all contacts
    do {
      attempt++;
      try {
        const response = People.People.Connections.list('people/me', {
          pageSize,
          personFields,
          pageToken
        });

        const connections = response.connections || [];
        for (const person of connections) {
          const labels = resolveLabelsForPerson(person, labelManager);

          // Skip contacts that don't match the label filter
          if (!matchesLabelFilter(labelNames, labels)) continue;

          const contact = parseContactFromPerson(person, labels);
          if (contact) contacts.push(contact);
        }

        pageToken = response.nextPageToken;
        attempt = 0; // Reset on success
      } catch (error) {
        retryOrThrow(error, attempt, retries);
      }
    } while (pageToken || (attempt > 0 && attempt <= retries));

    Logger.log(`📇 Fetched ${contacts.length} contacts`);
    return contacts;
  } catch (error) {
    Logger.log(`💥 Critical error fetching contacts: ${error.message}`);
    return [];
  }
}


/**
 * Parses a People API person object into a Contact instance.
 *
 * @param {Object} person Raw person object from the People API
 * @param {string[]} labels Resolved label names for this person
 * @returns {Contact|null} A Contact instance, or null if parsing fails
 * @private
 */
function parseContactFromPerson(person, labels) {
  try {
    // Parse birthday: use current year as placeholder if year is missing
    let birthday = null;
    if (person.birthdays?.[0]) {
      const { year, month, day } = person.birthdays[0].date;
      birthday = new Date(year || new Date().getFullYear(), month - 1, day);
    }

    // Combine all city values from addresses
    const city = (person.addresses || [])
      .map(addr => addr.city)
      .filter(Boolean)
      .join(', ');

    // Extract Instagram usernames from biography/notes
    const notes = (person.biographies || []).map(bio => bio.value).join('. ');
    const urls = person.urls || [];

    // Gather Instagram names from notes AND website fields
    const instagramFromNotes = extractInstagramNamesFromNotes(notes);
    const instagramFromUrls = extractInstagramNamesFromUrls(urls);
    const instagram = deduplicateInstagramNames([...instagramFromNotes, ...instagramFromUrls]);

    return new Contact(
      person.names?.[0]?.displayName || 'Unnamed Contact',
      birthday,
      labels,
      person.emailAddresses?.[0]?.value,
      city,
      person.phoneNumbers?.[0]?.value || '',
      instagram,
      person.resourceName || '',
      notes,
      urls,
      person.etag || ''
    );
  } catch (error) {
    Logger.log(`⚠️ Error parsing contact: ${error.message}`);
    return null;
  }
}


/**
 * Resolves label names for a person by looking up their group memberships.
 *
 * @param {Object} person People API person object
 * @param {LabelManager} labelManager Label lookup instance
 * @returns {string[]} Array of human-readable label names
 * @private
 */
function resolveLabelsForPerson(person, labelManager) {
  try {
    const memberships = person.memberships || [];
    const labelIds = memberships
      .filter(m => m.contactGroupMembership)
      .map(m => m.contactGroupMembership.contactGroupId);

    const names = labelManager.getLabelNamesByIds(labelIds);
    return Array.isArray(names) ? names : [];
  } catch (error) {
    Logger.log(`❌ Error resolving labels: ${error.message}`);
    return [];
  }
}


/**
 * Checks if a contact's labels satisfy the label filter.
 * An empty filter means "include all contacts".
 *
 * @param {string[]} filter Required labels (empty = no filter)
 * @param {string[]} contactLabels The contact's actual labels
 * @returns {boolean} True if the contact should be included
 * @private
 */
function matchesLabelFilter(filter, contactLabels) {
  if (filter.length === 0) return true;
  return contactLabels.some(label => filter.includes(label.trim()));
}


/**
 * Handles an API error with exponential backoff.
 * Throws if max retries are exhausted.
 *
 * @param {Error} error The error that occurred
 * @param {number} attempt Current attempt number (1-based)
 * @param {number} maxRetries Maximum allowed retries
 * @throws {Error} If all retries are exhausted
 * @private
 */
function retryOrThrow(error, attempt, maxRetries) {
  // Exponential backoff with jitter
  const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;

  Logger.log(`❌ API Error (attempt ${attempt}/${maxRetries}): ${error.message}`);
  Logger.log(`⏳ Retrying in ${(delay / 1000).toFixed(1)}s...`);

  if (attempt >= maxRetries) {
    Logger.log('💥 Maximum retries exceeded');
    throw error;
  }

  Utilities.sleep(delay);
}


/**
 * Validates that a label filter is a valid array of strings.
 *
 * @param {*} labelFilter Value to validate
 * @throws {Error} If the filter is not a valid string array
 */
function validateLabelFilter(labelFilter) {
  if (!Array.isArray(labelFilter)) {
    throw new Error('🔴 Label filter must be an array');
  }
  if (labelFilter.some(label => typeof label !== 'string')) {
    throw new Error('🔴 All labels must be strings');
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// Filters — Finding contacts that match specific criteria
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Finds contacts that have no labels assigned.
 *
 * @param {Contact[]} contacts Contacts to search
 * @returns {Contact[]} Contacts with zero labels
 */
function findUnlabeled(contacts) {
  return contacts.filter(c => c.getLabels().length === 0);
}


/**
 * Finds contacts with a birthday in the next N days.
 * Results are sorted by soonest birthday first.
 *
 * @param {Contact[]} contacts Contacts to search
 * @param {number} [days=7] Number of days to look ahead
 * @returns {Contact[]} Contacts with upcoming birthdays, sorted by date
 */
function findUpcomingBirthdays(contacts, days = 7) {
  const today = new Date();
  const cutoff = new Date();
  cutoff.setDate(today.getDate() + days);

  return contacts
    .filter(c => c.getBirthday()) // Only contacts with a birthday
    .map(c => {
      // Calculate next occurrence of this birthday
      const bday = c.getBirthday();
      const next = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      return { contact: c, nextBirthday: next };
    })
    .filter(item => item.nextBirthday >= today && item.nextBirthday <= cutoff)
    .sort((a, b) => a.nextBirthday - b.nextBirthday)
    .map(item => item.contact);
}


/**
 * Finds contacts with phone numbers that don't match the configured regex.
 *
 * @param {Contact[]} contacts Contacts to search
 * @returns {Contact[]} Contacts with invalid-looking phone numbers
 */
function findInvalidPhones(contacts) {
  const regex = typeof phoneRegex !== 'undefined' ? phoneRegex : /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
  return contacts.filter(c => {
    const phone = c.phoneNumber;
    return phone && phone.trim() && !regex.test(phone.trim());
  });
}


/**
 * Finds contacts that share the same phone number with another contact.
 * Returns one entry per duplicate number (listing all contacts that share it).
 *
 * @param {Contact[]} contacts Contacts to search
 * @returns {Object[]} Array of { phone, contacts: Contact[] }
 */
function findDuplicatePhones(contacts) {
  const phoneMap = new Map();
  contacts.forEach(c => {
    const phone = (c.phoneNumber || '').replace(/[\s\-().]/g, '').trim();
    if (!phone) return;
    if (!phoneMap.has(phone)) phoneMap.set(phone, []);
    phoneMap.get(phone).push(c);
  });
  return [...phoneMap.entries()]
    .filter(([_, arr]) => arr.length > 1)
    .map(([phone, arr]) => ({ phone, contacts: arr }));
}


/**
 * Finds contacts with only a name but no other useful info
 * (no email, no phone, no city, no birthday).
 *
 * @param {Contact[]} contacts Contacts to search
 * @returns {Contact[]} Contacts with only a name
 */
function findEmptyContacts(contacts) {
  return contacts.filter(c => {
    return !c.email &&
      !c.phoneNumber &&
      !c.city &&
      !c.getBirthday();
  });
}


/**
 * Finds contacts with potential name formatting issues:
 * - ALL CAPS names
 * - all lowercase names
 *
 * @param {Contact[]} contacts Contacts to search
 * @returns {Contact[]} Contacts with formatting issues
 */
function findBadlyFormattedNames(contacts) {
  return contacts.filter(c => {
    const name = c.getName().trim();
    if (!name || name.length < 2) return false;
    // Only check names that have letters (skip purely numeric/symbol names)
    const letters = name.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    if (letters.length < 2) return false;
    return letters === letters.toUpperCase() || letters === letters.toLowerCase();
  });
}


/**
 * Finds contacts that mention Messenger/FB in notes but have no username.
 *
 * @param {Contact[]} contacts Contacts to search
 * @returns {Contact[]} Contacts with incomplete Messenger info
 */
function findIncompleteMessenger(contacts) {
  return contacts.filter(c => c.hasMessengerTag && c.messengerNames.length === 0);
}


/**
 * Finds contacts whose name has no space (likely missing a surname).
 *
 * @param {Contact[]} contacts Contacts to search
 * @returns {Contact[]} Contacts with single-word names
 */
function findMissingSurnames(contacts) {
  return contacts.filter(c => {
    const name = c.getName().trim();
    return name && !name.includes(' ');
  });
}


/**
 * Finds contacts missing a specific field.
 *
 * @param {Contact[]} contacts Contacts to search
 * @param {string} field Field to check: 'email', 'phone', 'city', or 'birthday'
 * @returns {Contact[]} Contacts where the field is empty/missing
 */
function findMissingField(contacts, field) {
  return contacts.filter(c => {
    switch (field) {
      case 'email':    return !c.email || !c.email.trim();
      case 'phone':    return !c.phoneNumber || !c.phoneNumber.trim();
      case 'city':     return !c.city || !c.city.trim();
      case 'birthday': return !c.getBirthday();
      default:         return false;
    }
  });
}


/**
 * Finds groups of contacts that appear to be duplicates.
 * Uses index maps for O(n) performance instead of O(n²) comparison.
 *
 * Contacts are grouped if they share any of the configured match fields
 * (name, email, or phone). Groups connected by shared fields are merged.
 *
 * @param {Contact[]} contacts Contacts to search
 * @param {string[]} [matchFields=['name', 'email', 'phone']] Fields to compare
 * @returns {Object[]} Array of { contacts, count, reason }
 */
function findDuplicates(contacts, matchFields) {
  const fields = matchFields || ['name', 'email', 'phone'];
  const groups = [];  // Array of Sets containing contact indices
  const groupOf = new Array(contacts.length).fill(-1); // index → group ID
  const groupReasons = []; // Array of Sets of reason strings, parallel to groups

  // Build lookup maps: field value → [contact indices]
  const nameIndex = new Map();
  const emailIndex = new Map();
  const phoneIndex = new Map();

  contacts.forEach((contact, i) => {
    if (fields.includes('name')) {
      const key = contact.getName().toLowerCase().trim();
      if (!nameIndex.has(key)) nameIndex.set(key, []);
      nameIndex.get(key).push(i);
    }
    if (fields.includes('email') && contact.email) {
      const key = contact.email.trim().toLowerCase();
      if (!emailIndex.has(key)) emailIndex.set(key, []);
      emailIndex.get(key).push(i);
    }
    if (fields.includes('phone') && contact.phoneNumber) {
      const key = contact.phoneNumber.trim();
      if (!phoneIndex.has(key)) phoneIndex.set(key, []);
      phoneIndex.get(key).push(i);
    }
  });

  /**
   * Merges a set of contact indices into a single group and records the reason.
   * @param {number[]} indices Contact indices that should be in the same group
   * @param {string} reason Why these contacts match
   */
  function mergeIntoGroup(indices, reason) {
    if (indices.length < 2) return;

    // Find existing group for any of these indices
    let target = -1;
    for (const idx of indices) {
      if (groupOf[idx] !== -1) { target = groupOf[idx]; break; }
    }

    // Create new group if none exists
    if (target === -1) {
      target = groups.length;
      groups.push(new Set());
      groupReasons.push(new Set());
    }

    // Record the match reason
    groupReasons[target].add(reason);

    // Add all indices to the target group, merging if needed
    for (const idx of indices) {
      if (groupOf[idx] === -1) {
        groups[target].add(idx);
        groupOf[idx] = target;
      } else if (groupOf[idx] !== target) {
        // Merge the other group into target
        const other = groupOf[idx];
        for (const otherIdx of groups[other]) {
          groups[target].add(otherIdx);
          groupOf[otherIdx] = target;
        }
        // Merge reasons too
        for (const r of groupReasons[other]) {
          groupReasons[target].add(r);
        }
        groups[other] = new Set();
        groupReasons[other] = new Set();
      }
    }
  }

  // Process each index map with specific reasons
  for (const [key, indices] of nameIndex.entries()) {
    mergeIntoGroup(indices, `same name: "${key}"`);
  }
  for (const [key, indices] of emailIndex.entries()) {
    mergeIntoGroup(indices, `same email: ${key}`);
  }
  for (const [key, indices] of phoneIndex.entries()) {
    mergeIntoGroup(indices, `same phone: ${key}`);
  }

  // Convert non-empty groups to output format
  return groups
    .filter((group, i) => group.size >= 2)
    .map((group, i) => {
      // Find the original index to get the right reasons
      const originalIdx = groups.indexOf(group);
      const members = [...group].map(idx => contacts[idx]);
      const reasons = [...groupReasons[originalIdx]].join(', ');
      return { contacts: members, count: members.length, reason: reasons };
    });
}


// ═══════════════════════════════════════════════════════════════════════════════
// Statistics — Aggregating data about contacts
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Computes label usage statistics across all contacts.
 *
 * @param {Contact[]} contacts Contacts to analyze
 * @returns {Object} Label statistics including counts, averages, and distribution data
 */
function computeLabelStats(contacts) {
  // Count how many contacts use each label
  const counts = {};
  let totalAssignments = 0;
  let multiLabelCount = 0;
  let maxLabelsOnContact = 0;
  let singleLabelCount = 0;

  contacts.forEach(c => {
    const labelCount = c.getLabels().length;
    totalAssignments += labelCount;
    if (labelCount > 1) multiLabelCount++;
    if (labelCount === 1) singleLabelCount++;
    if (labelCount > maxLabelsOnContact) maxLabelsOnContact = labelCount;

    c.getLabels().forEach(label => {
      counts[label] = (counts[label] || 0) + 1;
    });
  });

  // Sort labels by usage (most used first)
  const sorted = Object.entries(counts)
    .map(([label, count]) => ({
      label,
      count,
      percentage: ((count / contacts.length) * 100).toFixed(1)
    }))
    .sort((a, b) => b.count - a.count);

  const unlabeledCount = contacts.filter(c => c.getLabels().length === 0).length;
  const labeledCount = contacts.length - unlabeledCount;
  const avgLabelsPerContact = contacts.length > 0 ? (totalAssignments / contacts.length).toFixed(1) : '0.0';
  const avgLabelsPerLabeled = labeledCount > 0 ? (totalAssignments / labeledCount).toFixed(1) : '0.0';

  return {
    totalLabels: sorted.length,
    mostUsed: sorted[0] || null,
    leastUsed: sorted[sorted.length - 1] || null,
    allLabels: sorted,
    unlabeledCount,
    labeledCount,
    multiLabelCount,
    singleLabelCount,
    maxLabelsOnContact,
    avgLabelsPerContact,
    avgLabelsPerLabeled,
  };
}


/**
 * Computes comprehensive statistics about a contact collection.
 * Runs in a single pass for efficiency.
 *
 * @param {Contact[]} contacts Contacts to analyze
 * @returns {Object} Statistics with counts, percentages, and label distribution
 */
function computeContactStats(contacts) {
  const total = contacts.length;

  // Single-pass counters
  let withBirthday = 0, withEmail = 0, withPhone = 0;
  let withCity = 0, withLabels = 0, withInstagram = 0;
  let withoutSurnames = 0;
  const labelDistribution = {};
  const cityDistribution = {};
  const birthdayMonths = new Array(12).fill(0); // index 0 = Jan, 11 = Dec

  // Completeness: count how many of the 4 key fields each contact has
  const completeness = [0, 0, 0, 0, 0]; // index = number of fields filled (0-4)
  let completeCount = 0; // contacts with all 4 key fields

  contacts.forEach(c => {
    const hasEmail = !!c.email;
    const hasPhone = !!c.phoneNumber;
    const hasBirthday = !!c.getBirthday();
    const hasCity = !!c.city;

    if (hasEmail) withEmail++;
    if (hasPhone) withPhone++;
    if (hasBirthday) {
      withBirthday++;
      birthdayMonths[c.getBirthday().getMonth()]++;
    }
    if (hasCity) withCity++;
    if (c.instagramNames.length > 0) withInstagram++;

    // Completeness score (4 key fields: email, phone, birthday, city)
    const fieldCount = [hasEmail, hasPhone, hasBirthday, hasCity].filter(Boolean).length;
    completeness[fieldCount]++;
    if (fieldCount === 4) completeCount++;

    // City distribution
    if (c.city) {
      const city = c.city.trim();
      cityDistribution[city] = (cityDistribution[city] || 0) + 1;
    }

    const labels = c.getLabels();
    if (labels.length > 0) {
      withLabels++;
      labels.forEach(label => { labelDistribution[label] = (labelDistribution[label] || 0) + 1; });
    }

    // Single-word name = likely missing surname
    if (c.getName().trim() && !c.getName().includes(' ')) withoutSurnames++;
  });

  // Top cities (sorted by count, top 5)
  const topCities = Object.entries(cityDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([city, count]) => ({ city, count }));

  /** Calculates percentage, safe for zero total */
  const pct = (n) => total ? (n / total * 100).toFixed(1) : '0.0';

  return {
    totalContacts: total,
    withBirthday,
    withEmail,
    withPhone,
    withCity,
    withLabels,
    withInstagram,
    withoutSurnames,
    birthdayPercentage: pct(withBirthday),
    emailPercentage: pct(withEmail),
    phonePercentage: pct(withPhone),
    cityPercentage: pct(withCity),
    labelPercentage: pct(withLabels),
    instagramPercentage: pct(withInstagram),
    labelDistribution,
    // New stats
    completeness,
    completeCount,
    completenessPercentage: pct(completeCount),
    topCities,
    birthdayMonths,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// Debug helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Logs all contact names to the Apps Script log.
 * @param {Contact[]} contacts Contacts to log
 */
function logContactNames(contacts) {
  if (contacts.length === 0) {
    Logger.log('No contacts to display');
    return;
  }
  Logger.log(contacts.map(c => c.getName()));
}
