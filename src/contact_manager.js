/**
 * Fetches all contacts from Google Contacts, optionally filtering by labels.
 * @param {string[]} [labelFilter=[]] Array of label names to filter
 * @param {number} [maxRetries=3] Max API retry attempts
 * @returns {Contact[]} Array of Contact objects
 */
function fetchContacts(labelFilter = [], maxRetries = 3) {
  try {
    validateLabelFilter(labelFilter);
    const peopleService = People.People;
    const labelManager = new LabelManager();
    let contacts = [];
    let pageToken = null;
    let attempt = 0;

    const pageSize = typeof apiPageSize !== 'undefined' ? apiPageSize : 100;
    const personFields = typeof apiPersonFields !== 'undefined' ? apiPersonFields : 'names,birthdays,memberships,emailAddresses,phoneNumbers,addresses,biographies';
    const retries = typeof apiMaxRetries !== 'undefined' ? apiMaxRetries : maxRetries;

    if (labelFilter.length < 1) {
      Logger.log('🔍 Fetching all contacts from Google Contacts...');
    } else {
      Logger.log(`🔍 Fetching contacts with label(s): '${labelFilter.join(', ')}'...`);
    }

    do {
      attempt++;
      try {
        const response = peopleService.Connections.list('people/me', {
          pageSize: pageSize,
          personFields: personFields,
          pageToken: pageToken
        });

        const connections = response.connections || [];
        connections.forEach(person => {
          const contactLabels = getContactLabels(person, labelManager);
          const labelMatch = contactMatchesLabelFilter(labelFilter, contactLabels);

          if (labelMatch) {
            const contact = createContact(person, contactLabels);
            if (contact) {
              contacts.push(contact);
            }
          }
        });

        pageToken = response.nextPageToken;
        attempt = 0; // Reset retry counter on success
      } catch (error) {
        handleApiError(error, attempt, retries);
      }
    } while (pageToken || (attempt > 0 && attempt <= retries));

    Logger.log(`📇 Fetched ${contacts.length} contacts!`);
    return contacts;
  } catch (error) {
    Logger.log(`💥 Critical error fetching contacts: ${error.message}`);
    return [];
  }
}


/**
 * Creates a Contact object from a People API person response.
 * @param {Object} person People API person object
 * @param {string[]} labelNames Array of label names
 * @returns {Contact|null} Contact instance or null on error
 */
function createContact(person, labelNames) {
  try {
    let birthday = null;
    if (person.birthdays?.[0]) {
      const birthdayData = person.birthdays[0].date;
      const year = birthdayData.year || new Date().getFullYear();
      birthday = new Date(year, birthdayData.month - 1, birthdayData.day);
    }

    return new Contact(
      person.names?.[0]?.displayName || 'Unnamed Contact',
      birthday,
      labelNames,
      person.emailAddresses?.[0]?.value,
      (person.addresses || []).map(address => address.city).filter(Boolean).join(', '),
      person.phoneNumbers?.[0]?.value || '',
      extractInstagramNamesFromNotes((person.biographies || []).map(bio => bio.value).join('. ')),
      person.resourceName || ''
    );
  } catch (error) {
    Logger.log(`⚠️ Error creating contact: ${error.message}`);
    return null;
  }
}


/**
 * Retrieves all contact labels for a person.
 * @param {Object} person People API response object
 * @param {LabelManager} labelManager Label management instance
 * @returns {string[]} Array of label names
 */
function getContactLabels(person, labelManager) {
  try {
    const memberships = person.memberships || [];
    const labelIds = memberships
      .filter(m => m.contactGroupMembership)
      .map(m => m.contactGroupMembership.contactGroupId);
    const labelNames = labelManager.getLabelNamesByIds(labelIds);

    if (!Array.isArray(labelNames)) return [];
    return labelNames;
  } catch (error) {
    Logger.log(`❌ Error getting labels: ${error.message}`);
    return [];
  }
}


/**
 * Determines if a contact matches the label filter criteria.
 * @param {string[]} labelFilter Configured label filter
 * @param {string[]} contactLabels Contact's assigned labels
 * @returns {boolean}
 */
function contactMatchesLabelFilter(labelFilter, contactLabels) {
  try {
    if (labelFilter.length === 0) return true;
    return contactLabels.some(label => labelFilter.includes(label.trim()));
  } catch (error) {
    Logger.log(`❌ Label matching failed: ${error.message}`);
    return false;
  }
}


/**
 * Handles API errors with exponential backoff retry logic.
 * @param {Error} error Original error object
 * @param {number} attempt Current attempt number
 * @param {number} maxRetries Maximum allowed retries
 * @throws {Error} If retries exhausted
 */
function handleApiError(error, attempt, maxRetries) {
  const retryDelay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;

  Logger.log(`❌ API Error (attempt ${attempt}/${maxRetries}): ${error.message}`);
  Logger.log(`⏳ Retrying in ${(retryDelay / 1000).toFixed(1)} seconds...`);

  if (attempt >= maxRetries) {
    Logger.log('💥 Maximum retries exceeded');
    throw error;
  }

  Utilities.sleep(retryDelay);
}


/**
 * Validates label filter configuration.
 * @param {Array} labelFilter Labels to validate
 * @throws {Error} If invalid label format
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
// Contact query/filter functions
// ═══════════════════════════════════════════════════════════════════════════════


/**
 * Finds contacts without any labels assigned.
 * @param {Contact[]} contacts
 * @returns {Contact[]}
 */
function findContactsWithoutLabels(contacts) {
  return contacts.filter(contact => contact.getLabels().length === 0);
}


/**
 * Finds contacts with upcoming birthdays within the specified number of days.
 * @param {Contact[]} contacts
 * @param {number} [days=7] Days to look ahead
 * @returns {Contact[]} Sorted by upcoming birthday date
 */
function findContactsWithUpcomingBirthdays(contacts, days = 7) {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  const upcoming = contacts
    .filter(contact => contact.getBirthday())
    .map(contact => {
      const birthday = contact.getBirthday();
      const nextBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
      if (nextBirthday < today) {
        nextBirthday.setFullYear(today.getFullYear() + 1);
      }
      return { contact, nextBirthday };
    })
    .filter(item => item.nextBirthday >= today && item.nextBirthday <= futureDate)
    .sort((a, b) => a.nextBirthday - b.nextBirthday);

  return upcoming.map(item => item.contact);
}


/**
 * Finds contacts with potentially invalid phone numbers.
 * @param {Contact[]} contacts
 * @returns {Contact[]}
 */
function findContactsWithInvalidPhones(contacts) {
  const regex = typeof phoneRegex !== 'undefined' ? phoneRegex : /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
  return contacts.filter(contact => {
    const phone = contact.phoneNumber;
    return phone && phone.trim() && !regex.test(phone.trim());
  });
}


/**
 * Finds contacts without surnames (only first name, no space in name).
 * @param {Contact[]} contacts
 * @returns {Contact[]}
 */
function findContactsWithoutSurnames(contacts) {
  return contacts.filter(contact => {
    const name = contact.getName().trim();
    return name && !name.includes(' ');
  });
}


/**
 * Finds contacts missing a specific field.
 * @param {Contact[]} contacts
 * @param {string} field Field to check ('email', 'phone', 'city', 'birthday')
 * @returns {Contact[]}
 */
function findContactsMissingField(contacts, field) {
  return contacts.filter(contact => {
    switch (field) {
      case 'email': return !contact.email || !contact.email.trim();
      case 'phone': return !contact.phoneNumber || !contact.phoneNumber.trim();
      case 'city': return !contact.city || !contact.city.trim();
      case 'birthday': return !contact.getBirthday();
      default: return false;
    }
  });
}


/**
 * Finds potential duplicate contacts based on configured match fields.
 * @param {Contact[]} contacts
 * @param {string[]} [matchFields=['name', 'email', 'phone']] Fields to compare
 * @returns {Object[]} Array of duplicate groups
 */
function findPotentialDuplicates(contacts, matchFields) {
  const fields = matchFields || ['name', 'email', 'phone'];
  const duplicateGroups = [];
  const processed = new Set();

  contacts.forEach((contact, i) => {
    if (processed.has(i)) return;

    const similarContacts = [contact];
    const name1 = contact.getName().toLowerCase().trim();

    contacts.forEach((otherContact, j) => {
      if (i !== j && !processed.has(j)) {
        const name2 = otherContact.getName().toLowerCase().trim();
        let isMatch = false;

        if (fields.includes('name') && name1 === name2) isMatch = true;
        if (fields.includes('email') && contact.email && contact.email === otherContact.email) isMatch = true;
        if (fields.includes('phone') && contact.phoneNumber && contact.phoneNumber === otherContact.phoneNumber) isMatch = true;

        if (isMatch) {
          similarContacts.push(otherContact);
          processed.add(j);
        }
      }
    });

    if (similarContacts.length > 1) {
      duplicateGroups.push({
        contacts: similarContacts,
        count: similarContacts.length,
        reason: 'name/email/phone match'
      });
    }
    processed.add(i);
  });

  return duplicateGroups;
}


/**
 * Gets label usage statistics.
 * @param {Contact[]} contacts
 * @returns {Object} Label usage stats
 */
function getLabelUsageStats(contacts) {
  const labelCounts = {};
  contacts.forEach(contact => {
    contact.getLabels().forEach(label => {
      labelCounts[label] = (labelCounts[label] || 0) + 1;
    });
  });

  const labelStats = Object.entries(labelCounts)
    .map(([label, count]) => ({
      label,
      count,
      percentage: ((count / contacts.length) * 100).toFixed(1)
    }))
    .sort((a, b) => b.count - a.count);

  const unlabeledCount = contacts.filter(c => c.getLabels().length === 0).length;

  return {
    totalLabels: labelStats.length,
    mostUsed: labelStats[0] || null,
    leastUsed: labelStats[labelStats.length - 1] || null,
    allLabels: labelStats,
    unlabeledCount
  };
}


/**
 * Generates comprehensive statistics about a contacts collection.
 * @param {Contact[]} contacts
 * @returns {Object} Statistics object
 */
function generateContactStats(contacts) {
  const totalContacts = contacts.length;

  // Single pass for all field counts
  let withBirthday = 0, withEmail = 0, withPhone = 0;
  let withCity = 0, withLabels = 0, withInstagram = 0;
  let withoutSurnames = 0;
  const labelCounts = {};

  contacts.forEach(c => {
    if (c.getBirthday()) withBirthday++;
    if (c.email) withEmail++;
    if (c.phoneNumber) withPhone++;
    if (c.city) withCity++;
    if (c.instagramNames.length > 0) withInstagram++;

    const labels = c.getLabels();
    if (labels.length > 0) {
      withLabels++;
      labels.forEach(label => {
        labelCounts[label] = (labelCounts[label] || 0) + 1;
      });
    }

    const name = c.getName().trim();
    if (name && !name.includes(' ')) withoutSurnames++;
  });

  const pct = (n) => totalContacts ? (n / totalContacts * 100).toFixed(1) : '0.0';

  return {
    totalContacts,
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
    labelDistribution: labelCounts
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// Logging helpers
// ═══════════════════════════════════════════════════════════════════════════════


/**
 * Logs the names of a list of contacts.
 * @param {Contact[]} contacts
 */
function logContactNames(contacts) {
  if (contacts.length === 0) {
    Logger.log('No contacts to display');
    return;
  }
  const names = contacts.map(contact => contact.getName());
  Logger.log(names);
}


/**
 * Logs detailed information for a list of contacts.
 * @param {Contact[]} contacts
 */
function logDetailedContactsList(contacts) {
  if (contacts.length === 0) {
    Logger.log('No contacts to display');
    return;
  }
  contacts.forEach(contact => {
    contact.logContactDetails();
    Logger.log('------------------------');
  });
}
