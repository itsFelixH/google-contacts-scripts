describe('Contact class', () => {
  test('creates contact with all fields', () => {
    const contact = new Contact(
      'John Doe', new Date('1990-01-01'), ['Friends', 'Work'],
      'john@example.com', 'Berlin', '+1234567890', ['@johndoe'], 'people/c123'
    );

    expect(contact.getName()).toBe('John Doe');
    expect(contact.getLabels()).toEqual(['Friends', 'Work']);
    expect(contact.email).toBe('john@example.com');
    expect(contact.city).toBe('Berlin');
    expect(contact.phoneNumber).toBe('+1234567890');
    expect(contact.instagramNames).toEqual(['@johndoe']);
    expect(contact.resourceName).toBe('people/c123');
  });

  test('throws on missing name', () => {
    expect(() => new Contact('', new Date())).toThrow();
    expect(() => new Contact(null, new Date())).toThrow();
  });

  test('handles null/empty birthday', () => {
    const c1 = new Contact('Test', null);
    expect(c1.getBirthday()).toBeNull();
    expect(c1.getBirthdayShortFormat()).toBe('');
    expect(c1.getBirthdayLongFormat()).toBe('');

    const c2 = new Contact('Test', '');
    expect(c2.getBirthday()).toBeNull();
  });

  test('formats birthday correctly', () => {
    const contact = new Contact('Test', new Date('1990-03-15'));
    expect(contact.getBirthdayShortFormat()).toBe('15.03.');
    expect(contact.getBirthdayLongFormat()).toBe('15.03.1990');
  });

  test('detects known birth year', () => {
    const withYear = new Contact('Test', new Date('1990-01-01'));
    expect(withYear.hasKnownBirthYear()).toBe(true);

    const currentYear = new Date().getFullYear();
    const withoutYear = new Contact('Test', new Date(currentYear, 5, 15));
    expect(withoutYear.hasKnownBirthYear()).toBe(false);
  });

  test('calculates age correctly', () => {
    const today = new Date();
    const birthYear = today.getFullYear() - 30;
    const contact = new Contact('Test', new Date(birthYear, 0, 1));
    expect(contact.calculateAge()).toBe(30);
  });

  test('returns 0 age when birth year unknown', () => {
    const contact = new Contact('Test', new Date(new Date().getFullYear(), 5, 15));
    expect(contact.calculateAge()).toBe(0);
  });

  test('generates WhatsApp link', () => {
    const contact = new Contact('Test', null, [], '', '', '+49 123 456 7890');
    expect(contact.getWhatsAppLink()).toBe('https://wa.me/491234567890');
  });

  test('returns empty WhatsApp link for short numbers', () => {
    const contact = new Contact('Test', null, [], '', '', '123');
    expect(contact.getWhatsAppLink()).toBe('');
  });

  test('generates Instagram links', () => {
    const contact = new Contact('Test', null, [], '', '', '', ['@user1', '@user2']);
    expect(contact.getAllInstagramLinks()).toEqual([
      'https://www.instagram.com/user1/',
      'https://www.instagram.com/user2/'
    ]);
  });

  test('generates Google Contacts link', () => {
    const contact = new Contact('Test', null, [], '', '', '', [], 'people/c12345');
    expect(contact.getContactLink()).toBe('https://contacts.google.com/person/c12345');
  });

  test('returns empty contact link without resourceName', () => {
    const contact = new Contact('Test', null);
    expect(contact.getContactLink()).toBe('');
  });

  test('handles invalid labels gracefully', () => {
    const contact = new Contact('Test', null, 'not-an-array');
    expect(contact.getLabels()).toEqual([]);
  });

  test('calculates days to next birthday', () => {
    const contact = new Contact('Test', new Date(1990, 0, 1));
    const days = contact.daysToNextBirthday();
    expect(days).toBeGreaterThanOrEqual(0);
    expect(days).toBeLessThanOrEqual(365);
  });
});


describe('Contact query functions', () => {
  const contacts = [
    new Contact('John Doe', new Date('1990-01-15'), ['Friends'], 'john@test.com', 'Berlin', '+491234567890'),
    new Contact('Jane', null, [], '', 'Munich'),
    new Contact('Bob Smith', new Date('1985-06-20'), ['Work', 'Friends'], 'bob@test.com', '', '+invalid'),
    new Contact('Alice', new Date(new Date().getFullYear(), 0, 1), ['Work']),
  ];

  test('findContactsWithoutLabels', () => {
    const result = findContactsWithoutLabels(contacts);
    expect(result).toHaveLength(1);
    expect(result[0].getName()).toBe('Jane');
  });

  test('findContactsWithoutBirthday', () => {
    const result = findContactsWithoutBirthday(contacts);
    expect(result).toHaveLength(1);
    expect(result[0].getName()).toBe('Jane');
  });

  test('findContactsWithLabel', () => {
    expect(findContactsWithLabel(contacts, 'Friends')).toHaveLength(2);
    expect(findContactsWithLabel(contacts, 'Work')).toHaveLength(2);
    expect(findContactsWithLabel(contacts, 'NonExistent')).toHaveLength(0);
    expect(findContactsWithLabel(contacts, '')).toHaveLength(0);
  });

  test('findContactsWithoutSurnames', () => {
    const result = findContactsWithoutSurnames(contacts);
    expect(result).toHaveLength(2);
    expect(result.map(c => c.getName())).toContain('Jane');
    expect(result.map(c => c.getName())).toContain('Alice');
  });

  test('findContactsWithInvalidPhones', () => {
    const result = findContactsWithInvalidPhones(contacts);
    expect(result).toHaveLength(1);
    expect(result[0].getName()).toBe('Bob Smith');
  });

  test('findContactsMissingField', () => {
    expect(findContactsMissingField(contacts, 'email')).toHaveLength(2);
    expect(findContactsMissingField(contacts, 'city')).toHaveLength(2);
    expect(findContactsMissingField(contacts, 'birthday')).toHaveLength(1);
  });

  test('findPotentialDuplicates', () => {
    const dupes = [
      new Contact('Same Name', new Date()),
      new Contact('Same Name', new Date()),
      new Contact('Unique', new Date()),
    ];
    const result = findPotentialDuplicates(dupes);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
  });

  test('findLongNames', () => {
    const longNameContacts = [
      new Contact('A'.repeat(60), new Date()),
      new Contact('Short', new Date()),
    ];
    expect(findLongNames(longNameContacts, 50)).toHaveLength(1);
  });

  test('getContactsByCity', () => {
    const result = getContactsByCity(contacts);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('city');
    expect(result[0]).toHaveProperty('count');
  });

  test('getLabelUsageStats', () => {
    const stats = getLabelUsageStats(contacts);
    expect(stats.totalLabels).toBe(2);
    expect(stats.unlabeledCount).toBe(1);
    expect(stats.mostUsed.label).toBe('Friends');
  });

  test('generateContactStats', () => {
    const stats = generateContactStats(contacts);
    expect(stats.totalContacts).toBe(4);
    expect(stats.withBirthday).toBe(3);
    expect(stats.withEmail).toBe(2);
    expect(stats.withLabels).toBe(3);
    expect(stats.labelDistribution['Friends']).toBe(2);
  });
});


describe('findContactsWithUpcomingBirthdays', () => {
  test('finds birthdays within range', () => {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const nextWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6);
    const twoWeeks = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 13);

    const contacts = [
      new Contact('Tomorrow', new Date(1990, tomorrow.getMonth(), tomorrow.getDate())),
      new Contact('Next Week', new Date(1990, nextWeek.getMonth(), nextWeek.getDate())),
      new Contact('Two Weeks', new Date(1990, twoWeeks.getMonth(), twoWeeks.getDate())),
    ];

    expect(findContactsWithUpcomingBirthdays(contacts, 7)).toHaveLength(2);
    expect(findContactsWithUpcomingBirthdays(contacts, 14)).toHaveLength(3);
  });

  test('returns sorted by date', () => {
    const today = new Date();
    const d1 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5);
    const d2 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);

    const contacts = [
      new Contact('Later', new Date(1990, d1.getMonth(), d1.getDate())),
      new Contact('Sooner', new Date(1990, d2.getMonth(), d2.getDate())),
    ];

    const result = findContactsWithUpcomingBirthdays(contacts, 7);
    expect(result[0].getName()).toBe('Sooner');
  });
});


describe('extractInstagramNamesFromNotes', () => {
  test('extracts @username patterns', () => {
    expect(extractInstagramNamesFromNotes('@johndoe')).toEqual(['@johndoe']);
    expect(extractInstagramNamesFromNotes('Follow @user1 and @user2')).toEqual(['@user1', '@user2']);
  });

  test('extracts Instagram: pattern', () => {
    expect(extractInstagramNamesFromNotes('Instagram: cooluser')).toEqual(['@cooluser']);
  });

  test('deduplicates usernames', () => {
    expect(extractInstagramNamesFromNotes('@same @same')).toEqual(['@same']);
  });

  test('handles empty/null input', () => {
    expect(extractInstagramNamesFromNotes('')).toEqual([]);
    expect(extractInstagramNamesFromNotes(null)).toEqual([]);
    expect(extractInstagramNamesFromNotes(undefined)).toEqual([]);
  });
});


describe('validateLabelFilter', () => {
  test('accepts valid arrays', () => {
    expect(() => validateLabelFilter([])).not.toThrow();
    expect(() => validateLabelFilter(['Friends'])).not.toThrow();
  });

  test('rejects non-arrays', () => {
    expect(() => validateLabelFilter('string')).toThrow();
    expect(() => validateLabelFilter(null)).toThrow();
  });

  test('rejects arrays with non-strings', () => {
    expect(() => validateLabelFilter([123])).toThrow();
    expect(() => validateLabelFilter([null])).toThrow();
  });
});
