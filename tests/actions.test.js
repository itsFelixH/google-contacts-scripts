describe('matchesAutoLabelRule', () => {
  const contact = new Contact('John Doe', null, [], 'john@company.com', 'Berlin', '+491234567890');

  test('matches email contains', () => {
    expect(matchesAutoLabelRule(contact, { field: 'email', contains: '@company.com', label: 'Work' })).toBe(true);
    expect(matchesAutoLabelRule(contact, { field: 'email', contains: '@other.com', label: 'X' })).toBe(false);
  });

  test('matches city equals', () => {
    expect(matchesAutoLabelRule(contact, { field: 'city', equals: 'berlin', label: 'Berlin' })).toBe(true);
    expect(matchesAutoLabelRule(contact, { field: 'city', equals: 'munich', label: 'X' })).toBe(false);
  });

  test('matches name startsWith', () => {
    expect(matchesAutoLabelRule(contact, { field: 'name', startsWith: 'john', label: 'J' })).toBe(true);
    expect(matchesAutoLabelRule(contact, { field: 'name', startsWith: 'jane', label: 'X' })).toBe(false);
  });

  test('matches email endsWith', () => {
    expect(matchesAutoLabelRule(contact, { field: 'email', endsWith: '.com', label: 'COM' })).toBe(true);
    expect(matchesAutoLabelRule(contact, { field: 'email', endsWith: '.de', label: 'X' })).toBe(false);
  });

  test('is case-insensitive', () => {
    expect(matchesAutoLabelRule(contact, { field: 'city', equals: 'BERLIN', label: 'X' })).toBe(true);
    expect(matchesAutoLabelRule(contact, { field: 'email', contains: '@COMPANY.COM', label: 'X' })).toBe(true);
  });

  test('returns false for unknown field', () => {
    expect(matchesAutoLabelRule(contact, { field: 'unknown', contains: 'x', label: 'X' })).toBe(false);
  });

  test('returns false for empty field value', () => {
    const noEmail = new Contact('Test', null, [], '', 'Berlin');
    expect(matchesAutoLabelRule(noEmail, { field: 'email', contains: '@', label: 'X' })).toBe(false);
  });
});


describe('formatName', () => {
  test('capitalizes first letter of each word', () => {
    expect(formatName('john doe')).toBe('John Doe');
    expect(formatName('JOHN DOE')).toBe('John Doe');
  });

  test('collapses multiple spaces', () => {
    expect(formatName('John   Doe')).toBe('John Doe');
    expect(formatName('  John  Doe  ')).toBe('John Doe');
  });

  test('swaps "Last, First" to "First Last" when enabled', () => {
    const original = global.nameSwapLastFirst;
    global.nameSwapLastFirst = true;
    expect(formatName('Doe, John')).toBe('John Doe');
    expect(formatName('Schmidt, Anna')).toBe('Anna Schmidt');
    global.nameSwapLastFirst = original;
  });

  test('does not swap "Last, First" when disabled', () => {
    expect(formatName('Doe, John')).toBe('Doe, John');
  });

  test('preserves lowercase prefixes', () => {
    expect(formatName('ludwig van beethoven')).toBe('Ludwig van Beethoven');
    expect(formatName('max von müller')).toBe('Max von Müller');
    expect(formatName('jean de la fontaine')).toBe('Jean de la Fontaine');
  });

  test('handles single names', () => {
    expect(formatName('felix')).toBe('Felix');
  });

  test('handles already correct names', () => {
    expect(formatName('John Doe')).toBe('John Doe');
    expect(formatName('Anna Schmidt')).toBe('Anna Schmidt');
  });
});


describe('normalizePhoneNumber', () => {
  test('converts local format to international', () => {
    expect(normalizePhoneNumber('0176 1234567', '+49')).toBe('+491761234567');
    expect(normalizePhoneNumber('01761234567', '+49')).toBe('+491761234567');
  });

  test('strips separators from international format', () => {
    expect(normalizePhoneNumber('+49 (176) 123-4567', '+49')).toBe('+491761234567');
    expect(normalizePhoneNumber('+49-176-1234567', '+49')).toBe('+491761234567');
  });

  test('leaves unknown formats unchanged', () => {
    expect(normalizePhoneNumber('1234567', '+49')).toBe('1234567');
    expect(normalizePhoneNumber('abc', '+49')).toBe('abc');
  });

  test('works with different country codes', () => {
    expect(normalizePhoneNumber('0201234567', '+1')).toBe('+1201234567');
    expect(normalizePhoneNumber('07911123456', '+44')).toBe('+447911123456');
  });
});


describe('runAutoLabeling', () => {
  test('returns zeros when no rules configured', () => {
    const result = runAutoLabeling();
    expect(result).toEqual({ applied: 0, skipped: 0, changes: [] });
  });
});


describe('runNameFormatter', () => {
  test('runs without errors in dry run', () => {
    global.dryRun = true;
    // Mock fetchContacts to return test data
    const origFetch = global.fetchContacts;
    global.fetchContacts = () => [new Contact('john doe', null)];

    const result = runNameFormatter();
    expect(result.fixed).toBe(1);

    global.fetchContacts = origFetch;
    global.dryRun = false;
  });
});


describe('runPhoneNormalizer', () => {
  test('runs without errors in dry run', () => {
    global.dryRun = true;
    const origFetch = global.fetchContacts;
    global.fetchContacts = () => [new Contact('Test', null, [], '', '', '0176 1234567')];

    const result = runPhoneNormalizer();
    expect(result.normalized).toBe(1);

    global.fetchContacts = origFetch;
    global.dryRun = false;
  });
});
