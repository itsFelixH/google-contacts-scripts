/**
 * Manages Google Contacts operations including fetching, filtering, and analysis
 * @class ContactManager
 */
class ContactManager {
  /**
   * Creates a ContactManager instance
   * @param {string[]} [labelFilter=[]] - Optional labels to filter contacts by
   * @param {boolean} [useCache=true] - Whether to use caching
   */
  constructor(labelFilter = [], useCache = true) {
    try {
      this.useCache = useCache;
      this.contacts = this.fetchContacts(labelFilter);
    } catch (error) {
      Logger.log(`Error initializing ContactManager: ${error.message}`);
      this.contacts = [];
    }
  }


  /**
   * Fetches contacts from Google Contacts API with optional label filtering
   * @param {string[]} [labelFilter=[]] - Labels to filter contacts by
   * @param {number} [maxRetries=3] - Maximum retry attempts for API calls
   * @returns {Contact[]} Array of Contact objects
   * @throws {Error} When API calls fail after max retries
   */
  fetchContacts(labelFilter = [], maxRetries = 3) {
    const cacheKey = `contacts_${JSON.stringify(labelFilter.sort())}`;
    
    if (this.useCache) {
      const cachedContacts = Cache.get(cacheKey);
      if (cachedContacts) {
        Logger.log(`📦 Using cached contacts (${cachedContacts.length} contacts)`);
        return cachedContacts.map(data => this.deserializeContact(data));
      }
    }
    
    try {
      this.validateLabelFilter(labelFilter);
      const peopleService = People.People;
      var labelManager = new LabelManager();
      let contacts = [];
      let pageToken = null;
      let attempt = 0;

      if (labelFilter == [] || labelFilter == [''] || labelFilter.length < 1) {
        Logger.log(`🔍 Fetching all contacts from Google Contacts...`);
      } else {
        Logger.log(`🔍 Fetching all contacts with any label(s) from '${labelFilter}' from Google Contacts...`);
      }

      do {
        attempt++;
        try {
          const response = peopleService.Connections.list('people/me', {
            pageSize: 100,
            personFields: 'names,birthdays,memberships,emailAddresses,phoneNumbers,addresses,biographies',
            pageToken: pageToken
          });

          const connections = response.connections || [];
          connections.forEach(person => {
            const contactLabels = this.getContactLabels(person, labelManager)
            const labelMatch = this.contactMatchesLabelFilter(labelFilter, contactLabels)

            if (labelMatch) {
              const contact = this.createContact(person, contactLabels);
              contacts.push(contact);
            }
          });

          pageToken = response.nextPageToken;
          attempt = 0; // Reset retry counter on success
        } catch (error) {
          this.handleApiError(error, attempt, maxRetries);
        }
      } while (pageToken && attempt <= maxRetries);

      if (this.useCache && contacts.length > 0) {
        const serializedContacts = contacts.map(contact => this.serializeContact(contact));
        Cache.set(cacheKey, serializedContacts, 30 * 60 * 1000);
        Logger.log(`💾 Cached ${contacts.length} contacts`);
      }
      
      Logger.log(`📇 Fetched ${contacts.length} contacts!`);
      return contacts;
    } catch (error) {
      Logger.log(`💥 Critical error fetching contacts: ${error.message}`);
      throw error;
    }
  }

  serializeContact(contact) {
    return {
      name: contact.name,
      birthday: contact.birthday ? contact.birthday.toISOString() : null,
      labels: contact.labels,
      email: contact.email,
      city: contact.city,
      phoneNumber: contact.phoneNumber,
      instagramNames: contact.instagramNames
    };
  }

  deserializeContact(data) {
    return new Contact(
      data.name,
      data.birthday ? new Date(data.birthday) : null,
      data.labels || [],
      data.email || '',
      data.city || '',
      data.phoneNumber || '',
      data.instagramNames || []
    );
  }

  clearCache() {
    try {
      const properties = PropertiesService.getScriptProperties().getProperties();
      Object.keys(properties).forEach(key => {
        if (key.startsWith('contacts_')) {
          Cache.delete(key);
        }
      });
      Logger.log('Contact cache cleared');
    } catch (error) {
      Logger.log(`Error clearing contact cache: ${error.message}`);
    }
  }


  /**
   * Handles API errors with retry logic
   * @param {Error} error - Original error object
   * @param {number} attempt - Current attempt number
   * @param {number} maxRetries - Maximum allowed retries
   * @throws {Error} If retries exhausted
   */
  handleApiError(error, attempt, maxRetries) {
    const retryDelay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;

    Logger.log(`❌ API Error (attempt ${attempt}/${maxRetries}): ${error.message}`);
    Logger.log(`⏳ Retrying in ${retryDelay / 1000} seconds...`);

    if (attempt >= maxRetries) {
      Logger.log("💥 Maximum retries exceeded");
      throw error;
    }

    Utilities.sleep(retryDelay);
  }


  /**
   * Validates label filter configuration
   * @param {Array} labelFilter - Labels to validate
   * @throws {Error} If invalid label format
   */
  validateLabelFilter(labelFilter) {
    if (!Array.isArray(labelFilter)) {
      throw new Error('🔴 Label filter must be an array');
    }

    if (labelFilter.some(label => typeof label !== 'string')) {
      throw new Error('🔴 All labels must be strings');
    }
  }


  /**
   * Creates Contact object from People API response
   * @param {Object} person - Person object from People API
   * @param {string[]} labelNames - Array of label names for this contact
   * @returns {Contact|null} Contact object or null if creation fails
   */
  createContact(person, labelNames) {
    try {
      if (person.birthdays?.[0]) {
        const birthdayData = person.birthdays?.[0]?.date
        const year = birthdayData.year || new Date().getFullYear();
        var birthday = new Date(year, birthdayData.month - 1, birthdayData.day);
      }

      return new Contact(
        person.names?.[0]?.displayName || 'Unnamed Contact',
        birthday || '',
        labelNames,
        person.emailAddresses?.[0]?.value,
        (person.addresses || []).map(address => address.city).filter(Boolean).join(', '),
        person.phoneNumbers?.[0]?.value || '',
        this.extractInstagramNamesFromNotes((person.biographies || []).map(bio => bio.value).join('. '))
      );
    } catch (error) {
      Logger.log(`⚠️ Error creating contact: ${error.message}`);
      return null;
    }
  }


  /**
   * Retrieves all contact labels for a person
   * @param {Object} person - People API response object
   * @param {LabelManager} labelManager - Label management instance
   * @returns {string[]} Array of label names
   */
  getContactLabels(person, labelManager) {
    try {
      const memberships = person.memberships || [];
      const labelIds = memberships
        .filter(m => m.contactGroupMembership)
        .map(m => m.contactGroupMembership.contactGroupId);
      const labelNames = labelManager.getLabelNamesByIds(labelIds);

      if (!Array.isArray(labelNames)) {
        // ⚠️ Invalid labels format for person.resourceName
        return [];
      }

      return labelNames;
    } catch (error) {
      Logger.log(`❌ Error getting labels: ${error.message}`);
      return [];
    }
  }


  /**
   * Determines if contact matches label filter criteria
   * @param {string[]} labelFilter - Configured label filter
   * @param {string[]} contactLabels - Contact's assigned labels
   * @returns {boolean} Match result
   */
  contactMatchesLabelFilter(labelFilter, contactLabels) {
    try {
      if (labelFilter.length === 0) {
        // ⚠️ Label filter empty
        return true;
      }

      // Check for matches
      const hasMatch = contactLabels.some(label =>
        labelFilter.includes(label.trim())
      );

      return hasMatch;
    } catch (error) {
      Logger.log(`❌ Label matching failed: ${error.message}`);
      return false;
    }
  }


  /**
   * Extracts Instagram usernames from the given notes.
   * Supports multiple usernames in different notes and comma-separated lists.
   *
   * @param {string} notes The notes containing Instagram usernames.
   * @returns {string[]} Array of Instagram usernames (with @ prefix), or empty array if none found.
   */
  extractInstagramNamesFromNotes(notes) {
    // Handle empty/undefined notes
    if (!notes) return [];

    const instagramPrefix = "@";
    const instagramNames = [];

    // Split notes into individual entries
    const noteEntries = notes.split('. ');

    // Process each note entry
    noteEntries.forEach(note => {
      // Extract usernames - could be comma-separated
      const usernamePart = note.substring(instagramPrefix.length).trim();
      const usernames = usernamePart.split(',').map(username => {
        username = username.trim();
        return username.startsWith('@') ? username : '@' + username;
      });
      instagramNames.push(...usernames);
      // Find all matches after prefix
      const matches = note.match(new RegExp(`(?:${instagramPrefix}|,\\s*)([^,\\s]+)`, 'g'));
      if (matches) {
        const usernames = matches.map(match => {
          // Clean up the username
          const cleaned_name = match.replace(/^,\s*/, '').trim();
          return cleaned_name.startsWith('@') ? cleaned_name : '@' + cleaned_name;
        });
        instagramNames.push(...usernames);
      }
    });

    return instagramNames;
  }


  /**
   * Logs all contact names to the console
   * @returns {void}
   */
  logAllContacts() {
    if (!this.contacts || this.contacts.length === 0) {
      Logger.log('No contacts to display');
      return;
    }
    
    Logger.log(`Displaying ${this.contacts.length} contacts:`);
    this.contacts.forEach((contact, index) => {
      Logger.log(`${index + 1}. ${contact.name}`);
    });
  }


  /**
   * Finds all contacts that don't have any labels assigned
   * @returns {Contact[]} Array of contacts without any labels
   */
  findContactsWithoutLabels() {
    try {
      return this.contacts.filter(contact => {
        const labels = contact.getLabels();
        return !labels || labels.length === 0;
      });
    } catch (error) {
      Logger.log(`Error finding unlabeled contacts: ${error.message}`);
      return [];
    }
  }

  /**
   * Finds all contacts that don't have a birthday set
   * @returns {Contact[]} Array of contacts without birthdays
   */
  findContactsWithoutBirthday() {
    try {
      return this.contacts.filter(contact => {
        const birthday = contact.getBirthday();
        return !birthday || birthday === '';
      });
    } catch (error) {
      Logger.log(`Error finding contacts without birthday: ${error.message}`);
      return [];
    }
  }

  /**
   * Finds all contacts that have a specific label
   * @param {string} label - The label to search for
   * @returns {Contact[]} Array of contacts with the specified label
   * @throws {Error} When label parameter is invalid
   */
  findContactsWithLabel(label) {
    if (!label || typeof label !== 'string') {
      throw new Error('Label parameter is required and must be a string');
    }
    
    try {
      return this.contacts.filter(contact => {
        const labels = contact.getLabels();
        return labels && labels.includes(label.trim());
      });
    } catch (error) {
      Logger.log(`Error finding contacts with label "${label}": ${error.message}`);
      return [];
    }
  }

  /**
   * Basic duplicate detection based on name similarity
   * @returns {Object[]} Array of potential duplicate groups
   */
  findPotentialDuplicates() {
    try {
      const duplicateGroups = [];
      const processed = new Set();
      
      this.contacts.forEach((contact, i) => {
        if (processed.has(i)) return;
        
        const similarContacts = [contact];
        const name1 = contact.getName().toLowerCase().trim();
        
        this.contacts.forEach((otherContact, j) => {
          if (i !== j && !processed.has(j)) {
            const name2 = otherContact.getName().toLowerCase().trim();
            
            // Simple similarity check
            if (name1 === name2 || 
                (contact.email && contact.email === otherContact.email) ||
                (contact.phoneNumber && contact.phoneNumber === otherContact.phoneNumber)) {
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
    } catch (error) {
      Logger.log(`Error finding duplicates: ${error.message}`);
      return [];
    }
  }

  /**
   * Finds all contacts with upcoming birthdays within the specified number of days
   * @param {number} days Number of days to look ahead (default: 7)
   * @returns {Array<Contact>} Array of contacts with upcoming birthdays, sorted by date
   */
  findContactsWithUpcomingBirthdays(days = 7) {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    
    // Filter contacts with birthdays and calculate their next birthday
    const contactsWithBirthdays = this.contacts.filter(contact => contact.getBirthday()).map(contact => {
      const birthday = new Date(contact.getBirthday());
      const nextBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
      
      // If the birthday has already passed this year, use next year's date
      if (nextBirthday < today) {
        nextBirthday.setFullYear(today.getFullYear() + 1);
      }
      
      return {
        contact: contact,
        nextBirthday: nextBirthday
      };
    });

    // Filter contacts whose birthdays fall within the specified range
    const upcomingBirthdays = contactsWithBirthdays.filter(item => 
      item.nextBirthday >= today && item.nextBirthday <= futureDate
    );

    // Sort by date
    upcomingBirthdays.sort((a, b) => a.nextBirthday - b.nextBirthday);

    return upcomingBirthdays.map(item => item.contact);
  }

  /**
   * Finds contacts with potentially invalid or malformed phone numbers
   * @returns {Contact[]} Array of contacts with suspicious phone numbers
   */
  findContactsWithInvalidPhones() {
    try {
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
      
      return this.contacts.filter(contact => {
        const phone = contact.phoneNumber;
        return phone && phone.trim() && !phoneRegex.test(phone.trim());
      });
    } catch (error) {
      Logger.log(`Error finding contacts with invalid phones: ${error.message}`);
      return [];
    }
  }

  /**
   * Finds contacts without surnames (only first name)
   * @returns {Contact[]} Array of contacts without surnames
   */
  findContactsWithoutSurnames() {
    try {
      return this.contacts.filter(contact => {
        const name = contact.getName().trim();
        return name && !name.includes(' ');
      });
    } catch (error) {
      Logger.log(`Error finding contacts without surnames: ${error.message}`);
      return [];
    }
  }

  /**
   * Finds contacts missing specific fields
   * @param {string} field - Field to check ('email', 'phone', 'city', 'birthday')
   * @returns {Contact[]} Array of contacts missing the specified field
   */
  findContactsMissingField(field) {
    try {
      return this.contacts.filter(contact => {
        switch(field) {
          case 'email': return !contact.email || !contact.email.trim();
          case 'phone': return !contact.phoneNumber || !contact.phoneNumber.trim();
          case 'city': return !contact.city || !contact.city.trim();
          case 'birthday': return !contact.getBirthday();
          default: return false;
        }
      });
    } catch (error) {
      Logger.log(`Error finding contacts missing ${field}: ${error.message}`);
      return [];
    }
  }


  /**
   * Gets label usage statistics
   * @returns {Object} Label usage statistics
   */
  getLabelUsageStats() {
    try {
      const stats = this.generateContactStats();
      const labelStats = Object.entries(stats.labelDistribution)
        .map(([label, count]) => ({
          label,
          count,
          percentage: ((count / stats.totalContacts) * 100).toFixed(1)
        }))
        .sort((a, b) => b.count - a.count);
      
      return {
        totalLabels: labelStats.length,
        mostUsed: labelStats[0] || null,
        leastUsed: labelStats[labelStats.length - 1] || null,
        allLabels: labelStats,
        unlabeledCount: stats.totalContacts - stats.withLabels
      };
    } catch (error) {
      Logger.log(`Error getting label usage stats: ${error.message}`);
      return {};
    }
  }

  /**
   * Groups contacts by city
   * @returns {Object} Contacts grouped by city
   */
  getContactsByCity() {
    try {
      const cityGroups = {};
      
      this.contacts.forEach(contact => {
        const city = contact.city?.trim() || 'No City';
        if (!cityGroups[city]) {
          cityGroups[city] = [];
        }
        cityGroups[city].push(contact);
      });
      
      return Object.entries(cityGroups)
        .map(([city, contacts]) => ({ city, contacts, count: contacts.length }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      Logger.log(`Error grouping contacts by city: ${error.message}`);
      return [];
    }
  }

  /**
   * Finds contacts with unusually long names
   * @param {number} [maxLength=50] - Maximum reasonable name length
   * @returns {Contact[]} Array of contacts with long names
   */
  findLongNames(maxLength = 50) {
    try {
      return this.contacts.filter(contact => 
        contact.getName().length > maxLength
      );
    } catch (error) {
      Logger.log(`Error finding long names: ${error.message}`);
      return [];
    }
  }

  /**
   * Adds label to multiple contacts
   * @param {Contact[]} contacts - Contacts to update
   * @param {string} label - Label to add
   * @returns {number} Number of contacts updated
   */
  bulkAddLabel(contacts, label) {
    try {
      let updated = 0;
      contacts.forEach(contact => {
        if (!contact.getLabels().includes(label)) {
          contact.labels.push(label);
          updated++;
        }
      });
      Logger.log(`Added label "${label}" to ${updated} contacts`);
      return updated;
    } catch (error) {
      Logger.log(`Error in bulk add label: ${error.message}`);
      return 0;
    }
  }

  /**
   * Removes label from multiple contacts
   * @param {Contact[]} contacts - Contacts to update
   * @param {string} label - Label to remove
   * @returns {number} Number of contacts updated
   */
  bulkRemoveLabel(contacts, label) {
    try {
      let updated = 0;
      contacts.forEach(contact => {
        const index = contact.labels.indexOf(label);
        if (index > -1) {
          contact.labels.splice(index, 1);
          updated++;
        }
      });
      Logger.log(`Removed label "${label}" from ${updated} contacts`);
      return updated;
    } catch (error) {
      Logger.log(`Error in bulk remove label: ${error.message}`);
      return 0;
    }
  }

  /**
   * Generates statistics about the contacts collection
   * @returns {Object} Object containing various statistics
   */
  generateContactStats() {
    const totalContacts = this.contacts.length;
    const withBirthday = this.contacts.filter(c => c.getBirthday()).length;
    const withEmail = this.contacts.filter(c => c.email).length;
    const withPhone = this.contacts.filter(c => c.phoneNumber).length;
    const withCity = this.contacts.filter(c => c.city).length;
    const withLabels = this.contacts.filter(c => c.getLabels().length > 0).length;
    const withInstagram = this.contacts.filter(c => c.instagramNames.length > 0).length;
    const withoutSurnames = this.findContactsWithoutSurnames().length;
    const longNames = this.findLongNames().length;

    // Get label distribution
    const labelCounts = {};
    this.contacts.forEach(contact => {
      contact.getLabels().forEach(label => {
        labelCounts[label] = (labelCounts[label] || 0) + 1;
      });
    });

    return {
      totalContacts,
      withBirthday,
      withEmail,
      withPhone,
      withCity,
      withLabels,
      withInstagram,
      withoutSurnames,
      longNames,
      birthdayPercentage: (withBirthday / totalContacts * 100).toFixed(1),
      emailPercentage: (withEmail / totalContacts * 100).toFixed(1),
      phonePercentage: (withPhone / totalContacts * 100).toFixed(1),
      cityPercentage: (withCity / totalContacts * 100).toFixed(1),
      labelPercentage: (withLabels / totalContacts * 100).toFixed(1),
      instagramPercentage: (withInstagram / totalContacts * 100).toFixed(1),
      surnamePercentage: ((totalContacts - withoutSurnames) / totalContacts * 100).toFixed(1),
      labelDistribution: labelCounts
    };
  }
}



/**
 * Represents a contact
 * @class Contact
 */
class Contact {
  /**
   * Creates a Contact instance
   * @param {string} name - The contact's display name
   * @param {Date|string|null} birthday - The contact's birthday
   * @param {string[]} [labels=[]] - Labels/tags associated with the contact
   * @param {string} [email=''] - The contact's email address
   * @param {string} [city=''] - The contact's city
   * @param {string} [phoneNumber=''] - The contact's phone number
   * @param {string[]} [instagramNames=[]] - Instagram usernames for the contact
   * @throws {Error} When required fields are invalid
   */
  constructor(name, birthday, labels = [], email = '', city = '', phoneNumber = '', instagramNames = []) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Contact name is required and must be a non-empty string');
    }
    
    this.name = name.trim();
    this.birthday = birthday ? new Date(birthday) : null;
    this.labels = Array.isArray(labels) ? labels.filter(l => l && typeof l === 'string') : [];
    this.email = (email || '').toString().trim();
    this.city = (city || '').toString().trim();
    this.phoneNumber = (phoneNumber || '').toString().trim();
    this.instagramNames = Array.isArray(instagramNames) 
      ? instagramNames.filter(name => name && typeof name === 'string')
      : [instagramNames].filter(name => name && typeof name === 'string');
  }


  /**
   * Gets the name of the contact
   * @returns {string} The contact's name
   */
  getName() {
    return this.name;
  }

  /**
   * Gets the birthday of the contact
   * @returns {Date|null} The contact's birthday
   */
  getBirthday() {
    return this.birthday;
  }

  /**
   * Gets the labels associated with the contact
   * @returns {string[]} Array of label names
   */
  getLabels() {
    return this.labels || [];
  }


  /**
   * Gets the birthday formatted as "dd.MM."
   * @returns {string} The formatted birthday or empty string
   */
  getBirthdayShortFormat() {
    try {
      if (this.birthday && this.birthday instanceof Date && !isNaN(this.birthday)) {
        return Utilities.formatDate(this.birthday, Session.getScriptTimeZone(), 'dd.MM.');
      }
      return '';
    } catch (error) {
      Logger.log(`Error formatting birthday for '${this.name}': ${error.message}`);
      return '';
    }
  }


  /**
   * Gets the birthday formatted as "dd.MM.yyyy", or "dd.MM." if the year is not specified or matches the current year.
   * 
   * @returns {string} The formatted birthday with or without the year.
   */
  getBirthdayLongFormat() {
    if (this.birthday) {
      if (this.birthday.getFullYear() == new Date().getFullYear()) {
        return this.getBirthdayShortFormat();
      } else {
        return Utilities.formatDate(this.birthday, Session.getScriptTimeZone(), "dd.MM.yyyy");
      }
    } else {
      Logger.log(`Birth day is missing for '${this.name}'`);
      return '';
    }
  }


  /**
   * Checks if the contact has a birth year specified (i.e., not the current year).
   * 
   * @returns {boolean} True if the contact has a birth year specified, false otherwise.
   */
  hasKnownBirthYear() {
    if (this.birthday) {
      return !(this.birthday.getFullYear() == new Date().getFullYear());
    } else {
      return false;
    }
  }


  /**
   * Calculates the age of the contact in years.
   *
   * @returns {number} The age of the contact in years.
   */
  calculateAge() {
    if (this.birthday) {
      var today = new Date();
      const birthDate = new Date(this.birthday);

      if (this.hasKnownBirthYear()) {
        var age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age;
      } else {
        Logger.log(`Birth year is missing for '${this.name}'`);
        return 0;
      }
    } else {
      Logger.log(`Birth day is missing for '${this.name}'`);
      return 0;
    }
  }


  /**
   * Generates a WhatsApp link using the contact's phone number
   * @returns {string} WhatsApp link or empty string if invalid phone number
   */
  getWhatsAppLink() {
    try {
      if (!this.phoneNumber) return '';
      
      const cleanedPhoneNumber = this.phoneNumber.replace(/\D/g, '');
      return cleanedPhoneNumber.length >= 7 ? `https://wa.me/${cleanedPhoneNumber}` : '';
    } catch (error) {
      Logger.log(`Error generating WhatsApp link for '${this.name}': ${error.message}`);
      return '';
    }
  }


  /**
   * Gets the Instagram link for a given username
   * @param {string} username - Instagram username (with or without @)
   * @returns {string} Instagram profile URL or empty string if invalid
   */
  getInstagramLink(username) {
    try {
      if (!username || typeof username !== 'string') return '';
      
      const cleanUsername = username.trim().replace(/^@/, '');
      return cleanUsername ? `https://www.instagram.com/${cleanUsername}/` : '';
    } catch (error) {
      Logger.log(`Error generating Instagram link: ${error.message}`);
      return '';
    }
  }


  /**
   * Gets all Instagram links for this contact.
   *
   * @returns {Array<string>} Array of Instagram links.
   */
  getAllInstagramLinks() {
    return this.instagramNames.map(name => this.getInstagramLink(name));
  }


  /**
   * Logs detailed information about the contact to the console, including name, birthday, age, labels, WhatsApp link , and Instagram link.
   * 
   * @returns {void}
   */
  logContactDetails() {
    Logger.log(`Name: ${this.name}`);
    if (this.birthday) Logger.log(`Birthday: ${this.getBirthdayLongFormat()}`);
    if (this.phoneNumber) Logger.log(`Telefon: ${this.phoneNumber}`);
    if (this.email) Logger.log(`Emails: ${this.email}`);
    if (this.city) Logger.log(`City: ${this.city}`);
    if (this.hasKnownBirthYear()) Logger.log(`Age: ${this.calculateAge()}`);
    if (this.phoneNumber) Logger.log(`WhatsApp: ${this.getWhatsAppLink()}`);
    if (this.instagramNames.length > 0) {
      this.instagramNames.forEach(name => {
        Logger.log(`Instagram: ${this.getInstagramLink(name)}`);
      });
    }
    if (this.labels.length > 0) Logger.log(`Labels: ${this.labels.join(', ')}`);
  }
}
