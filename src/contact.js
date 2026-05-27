/**
 * Represents a contact with all relevant information.
 */
class Contact {
  /**
   * Creates an instance of Contact.
   *
   * @param {string} name The display name of the contact.
   * @param {Date|string|null} birthday The birthday of the contact.
   * @param {Array<string>} labels Labels/tags associated with the contact.
   * @param {string} email The email address of the contact.
   * @param {string} city The city of the contact.
   * @param {string} phoneNumber The phone number of the contact.
   * @param {Array<string>} instagramNames Instagram usernames for the contact.
   * @param {string} resourceName The Google Contacts resource name (e.g., 'people/c12345').
   */
  constructor(name, birthday, labels = [], email = '', city = '', phoneNumber = '', instagramNames = [], resourceName = '') {
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
      ? instagramNames.filter(n => n && typeof n === 'string')
      : [instagramNames].filter(n => n && typeof n === 'string');
    this.resourceName = resourceName || '';
  }

  /**
   * Gets the name of the contact.
   * @returns {string}
   */
  getName() {
    return this.name;
  }

  /**
   * Gets the birthday of the contact.
   * @returns {Date|null}
   */
  getBirthday() {
    return this.birthday;
  }

  /**
   * Gets the labels associated with the contact.
   * @returns {Array<string>}
   */
  getLabels() {
    return this.labels;
  }

  /**
   * Checks if the contact has a birth year specified (not the current year placeholder).
   * @returns {boolean}
   */
  hasKnownBirthYear() {
    if (!this.birthday) return false;
    return this.birthday.getFullYear() !== new Date().getFullYear();
  }

  /**
   * Gets the birthday formatted as "dd.MM."
   * @returns {string}
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
   * Gets the birthday formatted as "dd.MM.yyyy", or "dd.MM." if year is unknown.
   * @returns {string}
   */
  getBirthdayLongFormat() {
    if (!this.birthday) return '';
    if (!this.hasKnownBirthYear()) {
      return this.getBirthdayShortFormat();
    }
    return Utilities.formatDate(this.birthday, Session.getScriptTimeZone(), 'dd.MM.yyyy');
  }

  /**
   * Calculates the current age of the contact in years.
   * @returns {number} Age in years, or 0 if birth year is unknown.
   */
  calculateAge() {
    if (!this.birthday || !this.hasKnownBirthYear()) return 0;

    const today = new Date();
    let age = today.getFullYear() - this.birthday.getFullYear();
    const monthDiff = today.getMonth() - this.birthday.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < this.birthday.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Gets the number of days until the next birthday.
   * @returns {number} Days until next birthday, or -1 if no birthday set.
   */
  daysToNextBirthday() {
    if (!this.birthday) return -1;

    const today = new Date();
    const nextBirthday = new Date(today.getFullYear(), this.birthday.getMonth(), this.birthday.getDate());

    if (today > nextBirthday) {
      nextBirthday.setFullYear(today.getFullYear() + 1);
    }

    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round((nextBirthday - today) / oneDay);
  }

  /**
   * Generates a WhatsApp link using the contact's phone number.
   * @returns {string} WhatsApp link or empty string.
   */
  getWhatsAppLink() {
    if (!this.phoneNumber) return '';
    const cleanedPhoneNumber = this.phoneNumber.replace(/\D/g, '');
    return cleanedPhoneNumber.length >= 7 ? `https://wa.me/${cleanedPhoneNumber}` : '';
  }

  /**
   * Gets the Instagram link for a given username.
   * @param {string} username Instagram username (with or without @)
   * @returns {string} Instagram profile URL or empty string.
   */
  getInstagramLink(username) {
    if (!username || typeof username !== 'string') return '';
    const cleanUsername = username.trim().replace(/^@/, '');
    return cleanUsername ? `https://www.instagram.com/${cleanUsername}/` : '';
  }

  /**
   * Gets all Instagram links for this contact.
   * @returns {Array<string>}
   */
  getAllInstagramLinks() {
    return this.instagramNames.map(name => this.getInstagramLink(name));
  }

  /**
   * Gets the Google Contacts link for this contact.
   * @returns {string} Google Contacts URL or empty string.
   */
  getContactLink() {
    if (!this.resourceName) return '';
    const contactId = this.resourceName.replace('people/', '');
    return `https://contacts.google.com/person/${contactId}`;
  }

  /**
   * Logs detailed information about the contact.
   */
  logContactDetails() {
    Logger.log(`Name: ${this.name}`);
    if (this.birthday) Logger.log(`Birthday: ${this.getBirthdayLongFormat()}`);
    if (this.phoneNumber) Logger.log(`Phone: ${this.phoneNumber}`);
    if (this.email) Logger.log(`Email: ${this.email}`);
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
