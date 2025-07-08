/**
 * Class to manage contacts.
 */
class ContactManager {
  constructor() {
    this.contacts = this.fetchContacts();
  }


  fetchContacts(labelFilter = [], maxRetries = 3) {
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

      Logger.log(`📇 Fetched ${contacts.length} contacts!`);
      return contacts;
    } catch (error) {
      Logger.log(`💥 Critical error fetching contacts: ${error.message}`);
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
   * Creates Contact object from API response
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
   * Logs all contacts.
   */
  logAllContacts() {
    this.contacts.forEach(contact => {
      Logger.log(contact.name);
    });
  }


  /**
   * Finds all contacts that don't have any labels assigned.
   * @returns {Array<Contact>} Array of contacts without any labels
   */
  findContactsWithoutLabels() {
    return this.contacts.filter(contact => {
      const labels = contact.getLabels();
      return !labels || labels.length === 0;
    });
  }

  /**
   * Finds all contacts that don't have a birthday set.
   * @returns {Array<Contact>} Array of contacts without birthdays
   */
  findContactsWithoutBirthday() {
    return this.contacts.filter(contact => {
      const birthday = contact.getBirthday();
      return !birthday || birthday === '';
    });
  }

  /**
   * Finds all contacts that have a specific label.
   * @param {string} label The label to search for
   * @returns {Array<Contact>} Array of contacts with the specified label
   */
  findContactsWithLabel(label) {
    if (!label) {
      throw new Error('Label parameter is required');
    }
    return this.contacts.filter(contact => {
      const labels = contact.getLabels();
      return labels && labels.includes(label);
    });
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
   * @returns {Array<Contact>} Array of contacts with suspicious phone numbers
   */
  findContactsWithInvalidPhones() {
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
    
    return this.contacts.filter(contact => {
      const phone = contact.phoneNumber;
      return phone && !phoneRegex.test(phone);
    });
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
      birthdayPercentage: (withBirthday / totalContacts * 100).toFixed(1),
      emailPercentage: (withEmail / totalContacts * 100).toFixed(1),
      phonePercentage: (withPhone / totalContacts * 100).toFixed(1),
      cityPercentage: (withCity / totalContacts * 100).toFixed(1),
      labelPercentage: (withLabels / totalContacts * 100).toFixed(1),
      instagramPercentage: (withInstagram / totalContacts * 100).toFixed(1),
      labelDistribution: labelCounts
    };
  }
}



/**
 * Represents a contact.
 */
class Contact {
  /**
   * Creates an instance of Contact.
   *
   * @param {string} name The name of the contact.
   * @param {Date} birthday The birthday of the contact.
   * @param {Array<string>} labels Labels/tags associated with the contact.
   * @param {string} email The email address of the contact.
   * @param {string} city The city of the contact.
   * @param {string} phoneNumber The phone number the contact.
   * @param {Array<string>} instagramNames The Instagram usernames for the contact.
   */
  constructor(name, birthday, labels = [], email = '', city = '', phoneNumber = '', instagramNames = []) {
    if (!name) {
      throw new Error('Name is required.');
    }
    this.name = name;
    this.birthday = birthday ? new Date(birthday) : null;
    this.labels = Array.isArray(labels) ? labels : [];
    this.email = email || '';
    this.city = city || '';
    this.phoneNumber = phoneNumber;
    this.instagramNames = Array.isArray(instagramNames) ? instagramNames : [instagramNames].filter(name => name !== '');
  }


  /**
   * Gets the name of the contact.
   * @returns {string} The name of the contact.
   */
  getName() {
    return this.name;
  }


  /**
   * Gets the birthday of the contact.
   * @returns {Date|null} The birthday of the contact.
   */
  getBirthday() {
    return this.birthday;
  }


  /**
   * Gets the labels associated with the contact.
   * @returns {Array<string>} The labels of the contact.
   */
  getLabels() {
    return this.labels;
  }


  /**
   * Gets the birthday formatted as "dd.MM.".
   * 
   * @returns {string} The formatted birthday.
   */
  getBirthdayShortFormat() {
    if (this.birthday) {
      return Utilities.formatDate(this.birthday, Session.getScriptTimeZone(), "dd.MM.");
    } else {
      Logger.log(`Birth day is missing for '${this.name}'`);
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
   * Generates a WhatsApp link using a phone number.
   *
   * @returns {string} The WhatsApp link for the given phone number, or an empty string if the phone number is invalid.
   */
  getWhatsAppLink() {
    if (this.phoneNumber) {
      const cleanedPhoneNumber = this.phoneNumber.replace(/\D/g, '');
      return cleanedPhoneNumber ? `https://wa.me/${cleanedPhoneNumber}` : '';
    }
    return ''
  }


  /**
   * Gets the Instagram link for a given username.
   *
   * @param {string} username The Instagram username
   * @returns {string} The Instagram link for the given username.
   */
  getInstagramLink(username) {
    const baseUrl = "https://www.instagram.com/";
    if (username) {
      return `${baseUrl}${username.substring(1)}/`;
    }
    return '';
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
