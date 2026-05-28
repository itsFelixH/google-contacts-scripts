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

  test('trims name whitespace', () => {
    const contact = new Contact('  Padded Name  ', null);
    expect(contact.getName()).toBe('Padded Name');
  });

  test('throws on missing name', () => {
    expect(() => new Contact('', new Date())).toThrow();
    expect(() => new Contact(null, new Date())).toThrow();
    expect(() => new Contact('   ', new Date())).toThrow();
  });

  test('handles null/empty birthday', () => {
    const c1 = new Contact('Test', null);
    expect(c1.getBirthday()).toBeNull();
    expect(c1.getBirthdayShortFormat()).toBe('');
    expect(c1.getBirthdayLongFormat()).toBe('');
    expect(c1.daysToNextBirthday()).toBe(-1);

    const c2 = new Contact('Test', '');
    expect(c2.getBirthday()).toBeNull();
  });

  test('formats birthday with default format (dd.MM.)', () => {
    const contact = new Contact('Test', new Date('1990-03-15'));
    expect(contact.getBirthdayShortFormat()).toBe('15.03.');
    expect(contact.getBirthdayLongFormat()).toBe('15.03.1990');
  });

  test('formats birthday with all format options', () => {
    const date = new Date(1990, 5, 15); // June 15

    expect(Contact.formatBirthday(date, 'dd.MM.')).toBe('15.06.');
    expect(Contact.formatBirthday(date, 'dd/MM')).toBe('15/06');
    expect(Contact.formatBirthday(date, 'MM/dd')).toBe('06/15');
    expect(Contact.formatBirthday(date, 'dd MMM')).toBe('15 Jun');
    expect(Contact.formatBirthday(date, 'MMM dd')).toBe('Jun 15');
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

  test('calculates age correctly when birthday has not occurred yet this year', () => {
    const today = new Date();
    const birthYear = today.getFullYear() - 25;
    // Birthday is in December (likely hasn't happened yet if test runs Jan-Nov)
    const contact = new Contact('Test', new Date(birthYear, 11, 31));
    const age = contact.calculateAge();
    // Should be 24 or 25 depending on current date
    expect(age).toBeGreaterThanOrEqual(24);
    expect(age).toBeLessThanOrEqual(25);
  });

  test('returns 0 age when birth year unknown', () => {
    const contact = new Contact('Test', new Date(new Date().getFullYear(), 5, 15));
    expect(contact.calculateAge()).toBe(0);
  });

  test('calculates days to next birthday', () => {
    const contact = new Contact('Test', new Date(1990, 0, 1));
    const days = contact.daysToNextBirthday();
    expect(days).toBeGreaterThanOrEqual(0);
    expect(days).toBeLessThanOrEqual(365);
  });

  test('generates WhatsApp link', () => {
    const contact = new Contact('Test', null, [], '', '', '+49 123 456 7890');
    expect(contact.getWhatsAppLink()).toBe('https://wa.me/491234567890');
  });

  test('returns empty WhatsApp link for short numbers', () => {
    const contact = new Contact('Test', null, [], '', '', '123');
    expect(contact.getWhatsAppLink()).toBe('');
  });

  test('returns empty WhatsApp link for no number', () => {
    const contact = new Contact('Test', null);
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

  test('filters null/empty labels', () => {
    const contact = new Contact('Test', null, ['Valid', '', null, 'Also Valid']);
    expect(contact.getLabels()).toEqual(['Valid', 'Also Valid']);
  });
});


describe('Contact query functions', () => {
  const contacts = [
    new Contact('John Doe', new Date('1990-01-15'), ['Friends'], 'john@test.com', 'Berlin', '+491234567890'),
    new Contact('Jane', null, [], '', 'Munich'),
    new Contact('Bob Smith', new Date('1985-06-20'), ['Work', 'Friends'], 'bob@test.com', '', '+invalid'),
    new Contact('Alice', new Date(new Date().getFullYear(), 0, 1), ['Work']),
  ];

  test('findUnlabeled', () => {
    const result = findUnlabeled(contacts);
    expect(result).toHaveLength(1);
    expect(result[0].getName()).toBe('Jane');
  });

  test('findUnlabeled returns empty for all-labeled contacts', () => {
    const labeled = [
      new Contact('A', null, ['X']),
      new Contact('B', null, ['Y']),
    ];
    expect(findUnlabeled(labeled)).toHaveLength(0);
  });

  test('findMissingSurnames', () => {
    const result = findMissingSurnames(contacts);
    expect(result).toHaveLength(2);
    expect(result.map(c => c.getName())).toContain('Jane');
    expect(result.map(c => c.getName())).toContain('Alice');
  });

  test('findMissingSurnames does not flag multi-word names', () => {
    const result = findMissingSurnames([
      new Contact('First Last', null),
      new Contact('One Two Three', null),
    ]);
    expect(result).toHaveLength(0);
  });

  test('findInvalidPhones', () => {
    const result = findInvalidPhones(contacts);
    expect(result).toHaveLength(1);
    expect(result[0].getName()).toBe('Bob Smith');
  });

  test('findInvalidPhones ignores contacts without phone', () => {
    const result = findInvalidPhones([
      new Contact('No Phone', null),
    ]);
    expect(result).toHaveLength(0);
  });

  test('findMissingField checks all fields', () => {
    expect(findMissingField(contacts, 'email')).toHaveLength(2);
    expect(findMissingField(contacts, 'phone')).toHaveLength(2);
    expect(findMissingField(contacts, 'city')).toHaveLength(2);
    expect(findMissingField(contacts, 'birthday')).toHaveLength(1);
  });

  test('findMissingField returns empty for invalid field', () => {
    expect(findMissingField(contacts, 'invalid')).toHaveLength(0);
  });
});


describe('findDuplicates', () => {
  test('finds duplicates by name with specific reason', () => {
    const dupes = [
      new Contact('Same Name', new Date()),
      new Contact('Same Name', new Date()),
      new Contact('Unique', new Date()),
    ];
    const result = findDuplicates(dupes, ['name']);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
    expect(result[0].reason).toContain('same name: "same name"');
  });

  test('finds duplicates by email with specific reason', () => {
    const dupes = [
      new Contact('Person A', null, [], 'same@test.com'),
      new Contact('Person B', null, [], 'same@test.com'),
      new Contact('Person C', null, [], 'different@test.com'),
    ];
    const result = findDuplicates(dupes, ['email']);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
    expect(result[0].reason).toContain('same email: same@test.com');
  });

  test('finds duplicates by phone with specific reason', () => {
    const dupes = [
      new Contact('Person A', null, [], '', '', '+123456789'),
      new Contact('Person B', null, [], '', '', '+123456789'),
      new Contact('Person C', null, [], '', '', '+999999999'),
    ];
    const result = findDuplicates(dupes, ['phone']);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
    expect(result[0].reason).toContain('same phone: +123456789');
  });

  test('merges groups and combines reasons', () => {
    // A and B share name, B and C share email → all in one group with both reasons
    const dupes = [
      new Contact('Same', null, [], 'a@test.com'),
      new Contact('Same', null, [], 'shared@test.com'),
      new Contact('Different', null, [], 'shared@test.com'),
    ];
    const result = findDuplicates(dupes, ['name', 'email']);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
    expect(result[0].reason).toContain('same name');
    expect(result[0].reason).toContain('same email');
  });

  test('returns empty for no duplicates', () => {
    const unique = [
      new Contact('Alice', null, [], 'a@test.com'),
      new Contact('Bob', null, [], 'b@test.com'),
    ];
    expect(findDuplicates(unique)).toHaveLength(0);
  });

  test('is case-insensitive for names', () => {
    const dupes = [
      new Contact('John Doe', null),
      new Contact('john doe', null),
    ];
    const result = findDuplicates(dupes, ['name']);
    expect(result).toHaveLength(1);
  });

  test('defaults to all match fields', () => {
    const dupes = [
      new Contact('Same', null),
      new Contact('Same', null),
    ];
    const result = findDuplicates(dupes);
    expect(result).toHaveLength(1);
  });
});


describe('computeLabelStats', () => {
  test('returns correct stats', () => {
    const contacts = [
      new Contact('A', null, ['Friends', 'Work']),
      new Contact('B', null, ['Friends']),
      new Contact('C', null, []),
    ];
    const stats = computeLabelStats(contacts);
    expect(stats.totalLabels).toBe(2);
    expect(stats.unlabeledCount).toBe(1);
    expect(stats.mostUsed.label).toBe('Friends');
    expect(stats.mostUsed.count).toBe(2);
    expect(stats.leastUsed.label).toBe('Work');
    expect(stats.leastUsed.count).toBe(1);
  });

  test('handles empty contacts', () => {
    const stats = computeLabelStats([]);
    expect(stats.totalLabels).toBe(0);
    expect(stats.unlabeledCount).toBe(0);
    expect(stats.mostUsed).toBeNull();
    expect(stats.leastUsed).toBeNull();
  });

  test('handles all contacts unlabeled', () => {
    const contacts = [
      new Contact('A', null, []),
      new Contact('B', null, []),
    ];
    const stats = computeLabelStats(contacts);
    expect(stats.totalLabels).toBe(0);
    expect(stats.unlabeledCount).toBe(2);
  });
});


describe('computeContactStats', () => {
  test('returns correct counts and percentages', () => {
    const contacts = [
      new Contact('John Doe', new Date('1990-01-15'), ['Friends'], 'john@test.com', 'Berlin', '+491234567890'),
      new Contact('Jane', null, [], '', 'Munich'),
      new Contact('Bob Smith', new Date('1985-06-20'), ['Work'], 'bob@test.com', '', '+123'),
      new Contact('Alice', new Date(new Date().getFullYear(), 0, 1), ['Work']),
    ];
    const stats = computeContactStats(contacts);

    expect(stats.totalContacts).toBe(4);
    expect(stats.withBirthday).toBe(3);
    expect(stats.withEmail).toBe(2);
    expect(stats.withPhone).toBe(2);
    expect(stats.withCity).toBe(2);
    expect(stats.withLabels).toBe(3);
    expect(stats.withoutSurnames).toBe(2);
    expect(stats.birthdayPercentage).toBe('75.0');
    expect(stats.emailPercentage).toBe('50.0');
    expect(stats.labelDistribution['Friends']).toBe(1);
    expect(stats.labelDistribution['Work']).toBe(2);
  });

  test('handles empty contacts list', () => {
    const stats = computeContactStats([]);
    expect(stats.totalContacts).toBe(0);
    expect(stats.birthdayPercentage).toBe('0.0');
    expect(stats.emailPercentage).toBe('0.0');
    expect(stats.labelDistribution).toEqual({});
  });
});


describe('findUpcomingBirthdays', () => {
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

    expect(findUpcomingBirthdays(contacts, 7)).toHaveLength(2);
    expect(findUpcomingBirthdays(contacts, 14)).toHaveLength(3);
  });

  test('returns sorted by date', () => {
    const today = new Date();
    const d1 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5);
    const d2 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);

    const contacts = [
      new Contact('Later', new Date(1990, d1.getMonth(), d1.getDate())),
      new Contact('Sooner', new Date(1990, d2.getMonth(), d2.getDate())),
    ];

    const result = findUpcomingBirthdays(contacts, 7);
    expect(result[0].getName()).toBe('Sooner');
  });

  test('excludes contacts without birthday', () => {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const contacts = [
      new Contact('Has Birthday', new Date(1990, tomorrow.getMonth(), tomorrow.getDate())),
      new Contact('No Birthday', null),
    ];

    expect(findUpcomingBirthdays(contacts, 7)).toHaveLength(1);
  });

  test('returns empty for no upcoming birthdays', () => {
    const today = new Date();
    const farAway = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 100);

    const contacts = [
      new Contact('Far Away', new Date(1990, farAway.getMonth(), farAway.getDate())),
    ];

    expect(findUpcomingBirthdays(contacts, 7)).toHaveLength(0);
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
