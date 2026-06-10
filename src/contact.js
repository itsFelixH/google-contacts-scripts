/**
 * @fileoverview Contact data model.
 * Represents a single Google Contact with all relevant fields and
 * provides methods for birthday calculations, link generation, and formatting.
 */


/**
 * A single contact from Google Contacts.
 *
 * Immutable after construction — all fields are set in the constructor
 * and accessed via getters or direct property access.
 */
class Contact {

  // ─── Construction ───────────────────────────────────────────────────────────

  /**
   * Creates a Contact instance.
   *
   * @param {string} name Display name (required, non-empty)
   * @param {Date|string|null} birthday Birthday date, or null if unknown
   * @param {string[]} labels Label/group names assigned to this contact
   * @param {string} email Primary email address
   * @param {string} city City from address fields
   * @param {string} phoneNumber Primary phone number
   * @param {string[]} instagramNames Instagram usernames (with @ prefix)
   * @param {string} resourceName Google People API resource ID (e.g. 'people/c12345')
   * @param {string} notes Raw biography/notes text
   * @param {Object[]} urls Website URL objects from People API
   * @param {string} etag People API etag for update operations
   * @throws {Error} If name is missing or empty
   */
  constructor(name, birthday, labels = [], email = '', city = '', phoneNumber = '', instagramNames = [], resourceName = '', notes = '', urls = [], etag = '') {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Contact name is required and must be a non-empty string');
    }

    /** @type {string} Display name, trimmed */
    this.name = name.trim();

    /** @type {Date|null} Birthday date, or null if not set */
    this.birthday = birthday ? new Date(birthday) : null;

    /** @type {string[]} Label names, filtered to valid strings only */
    this.labels = Array.isArray(labels) ? labels.filter(l => l && typeof l === 'string') : [];

    /** @type {string} Primary email address */
    this.email = (email || '').toString().trim();

    /** @type {string} City from address */
    this.city = (city || '').toString().trim();

    /** @type {string} Primary phone number */
    this.phoneNumber = (phoneNumber || '').toString().trim();

    /** @type {string[]} Instagram usernames */
    this.instagramNames = Array.isArray(instagramNames)
      ? instagramNames.filter(n => n && typeof n === 'string')
      : [instagramNames].filter(n => n && typeof n === 'string');

    /** @type {string} Google People API resource name */
    this.resourceName = resourceName || '';

    /** @type {string} Raw biography/notes text */
    this.notes = (notes || '').toString();

    /** @type {Object[]} Website URL objects */
    this.urls = Array.isArray(urls) ? urls : [];

    /** @type {string} People API etag for update operations */
    this.etag = etag || '';

    /** @type {boolean} Whether notes mention Messenger/FB without a username */
    this.hasMessengerTag = /\b(fb|messenger|facebook)\b/i.test(this.notes);

    /** @type {string[]} Messenger/Facebook usernames extracted from notes and URLs */
    this.messengerNames = this._extractMessengerNames(this.notes, this.urls);
  }

  /**
   * Extracts Messenger/Facebook usernames from notes and website URLs.
   * Notes patterns: "FB: username", "Messenger: username", "Facebook: username"
   * URL patterns: m.me/username, facebook.com/username, messenger.com/t/username
   * @param {string} notes
   * @param {Object[]} urls
   * @returns {string[]} Deduplicated usernames
   * @private
   */
  _extractMessengerNames(notes, urls) {
    const names = [];

    // Extract from notes
    if (notes) {
      const pattern = /(?:fb|messenger|facebook):\s*([a-zA-Z0-9_.]+)/gi;
      let match;
      while ((match = pattern.exec(notes)) !== null) {
        const username = match[1];
        if (!names.includes(username)) names.push(username);
      }
    }

    // Extract from URLs
    if (urls && Array.isArray(urls)) {
      urls.forEach(urlObj => {
        const url = urlObj.value || '';
        // m.me/username
        let match = url.match(/^https?:\/\/m\.me\/([a-zA-Z0-9_.]+)/i);
        if (match) { if (!names.includes(match[1])) names.push(match[1]); return; }
        // facebook.com/username (but not facebook.com/profile.php etc)
        match = url.match(/^https?:\/\/(www\.)?facebook\.com\/([a-zA-Z0-9_.]+)\/?$/i);
        if (match && !['profile.php', 'home.php', 'groups', 'pages', 'events', 'marketplace', 'watch', 'stories', 'reels', 'gaming', 'fundraisers', 'bookmarks', 'memories', 'notifications', 'messages', 'settings', 'help', 'login', 'recover'].includes(match[2])) {
          if (!names.includes(match[2])) names.push(match[2]);
        }
      });
    }

    return names;
  }


  // ─── Basic getters ──────────────────────────────────────────────────────────

  /**
   * @returns {string} The contact's display name
   */
  getName() {
    return this.name;
  }

  /**
   * @returns {Date|null} Birthday date, or null if not set
   */
  getBirthday() {
    return this.birthday;
  }

  /**
   * @returns {string[]} Array of label names
   */
  getLabels() {
    return this.labels;
  }


  // ─── Birthday methods ───────────────────────────────────────────────────────

  /**
   * Checks if the birth year is known (not a current-year placeholder).
   * Google Contacts uses the current year when only month/day are stored.
   * @returns {boolean}
   */
  hasKnownBirthYear() {
    if (!this.birthday) return false;
    return this.birthday.getFullYear() !== new Date().getFullYear();
  }

  /**
   * Formats the birthday using the configured format (short, no year).
   * @returns {string} Formatted date string, or '' if no birthday
   */
  getBirthdayShortFormat() {
    try {
      if (this.birthday && this.birthday instanceof Date && !isNaN(this.birthday)) {
        const format = typeof birthdayFormat !== 'undefined' ? birthdayFormat : 'dd.MM.';
        return Contact.formatBirthday(this.birthday, format);
      }
      return '';
    } catch (error) {
      Logger.log(`Error formatting birthday for '${this.name}': ${error.message}`);
      return '';
    }
  }

  /**
   * Formats the birthday with year appended (if year is known).
   * @returns {string} Formatted date string with year, or short format, or ''
   */
  getBirthdayLongFormat() {
    if (!this.birthday) return '';
    if (!this.hasKnownBirthYear()) {
      return this.getBirthdayShortFormat();
    }
    return `${this.getBirthdayShortFormat()}${this.birthday.getFullYear()}`;
  }

  /**
   * Calculates the contact's current age in years.
   * Accounts for whether this year's birthday has passed yet.
   * @returns {number} Age in years, or 0 if birth year is unknown
   */
  calculateAge() {
    if (!this.birthday || !this.hasKnownBirthYear()) return 0;

    const today = new Date();
    let age = today.getFullYear() - this.birthday.getFullYear();

    // Subtract 1 if this year's birthday hasn't happened yet
    const monthDiff = today.getMonth() - this.birthday.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < this.birthday.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Calculates days until the next occurrence of this contact's birthday.
   * @returns {number} Days until next birthday (0 = today), or -1 if no birthday
   */
  daysToNextBirthday() {
    if (!this.birthday) return -1;

    const today = new Date();
    const nextBirthday = new Date(today.getFullYear(), this.birthday.getMonth(), this.birthday.getDate());

    // If birthday already passed this year, look at next year
    if (today > nextBirthday) {
      nextBirthday.setFullYear(today.getFullYear() + 1);
    }

    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round((nextBirthday - today) / oneDay);
  }

  /**
   * Formats a date according to the given format string.
   *
   * @param {Date} date The date to format
   * @param {string} format One of: 'dd.MM.', 'dd/MM', 'MM/dd', 'dd MMM', 'MMM dd'
   * @returns {string} Formatted date string
   * @static
   */
  static formatBirthday(date, format) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthShort = monthNames[date.getMonth()];

    switch (format) {
      case 'dd/MM':    return `${day}/${month}`;
      case 'MM/dd':    return `${month}/${day}`;
      case 'dd MMM':   return `${day} ${monthShort}`;
      case 'MMM dd':   return `${monthShort} ${day}`;
      case 'dd.MM.':
      default:         return `${day}.${month}.`;
    }
  }


  // ─── Link generation ────────────────────────────────────────────────────────

  /**
   * Generates a WhatsApp chat link from the phone number.
   * Strips all non-digit characters and requires at least 7 digits.
   * @returns {string} WhatsApp URL or empty string
   */
  getWhatsAppLink() {
    if (!this.phoneNumber) return '';
    const digits = this.phoneNumber.replace(/\D/g, '');
    return digits.length >= 7 ? `https://wa.me/${digits}` : '';
  }

  /**
   * Generates an Instagram profile URL for a given username.
   * @param {string} username Instagram username (with or without @)
   * @returns {string} Instagram URL or empty string
   */
  getInstagramLink(username) {
    if (!username || typeof username !== 'string') return '';
    const clean = username.trim().replace(/^@/, '');
    return clean ? `https://www.instagram.com/${clean}/` : '';
  }

  /**
   * Gets Instagram profile URLs for all stored usernames.
   * @returns {string[]} Array of Instagram URLs
   */
  getAllInstagramLinks() {
    return this.instagramNames.map(name => this.getInstagramLink(name));
  }

  /**
   * Gets the Google Contacts edit URL for this contact.
   * @returns {string} Google Contacts URL or empty string if no resourceName
   */
  getContactLink() {
    if (!this.resourceName) return '';
    const contactId = this.resourceName.replace('people/', '');
    return `https://contacts.google.com/person/${contactId}`;
  }


  // ─── Debug ──────────────────────────────────────────────────────────────────

  /**
   * Logs all available details about this contact.
   * Useful for debugging in the Apps Script editor.
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
      this.instagramNames.forEach(name => Logger.log(`Instagram: ${this.getInstagramLink(name)}`));
    }
    if (this.labels.length > 0) Logger.log(`Labels: ${this.labels.join(', ')}`);
  }
}
