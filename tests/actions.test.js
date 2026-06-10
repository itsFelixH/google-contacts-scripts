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
    const original = global.nameFormatterConfig.swapLastFirst;
    global.nameFormatterConfig.swapLastFirst = true;
    expect(formatName('Doe, John')).toBe('John Doe');
    expect(formatName('Schmidt, Anna')).toBe('Anna Schmidt');
    global.nameFormatterConfig.swapLastFirst = original;
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

  test('capitalizes after hyphens', () => {
    expect(formatName('anna-lena müller')).toBe('Anna-Lena Müller');
    expect(formatName('hans-peter von berg')).toBe('Hans-Peter von Berg');
    expect(formatName('JEAN-CLAUDE')).toBe('Jean-Claude');
  });

  test('preserves parenthetical content as-is', () => {
    expect(formatName('anna (Swing Barcelona) castellví')).toBe('Anna (Swing Barcelona) Castellví');
    expect(formatName('FELIX (Vegan)')).toBe('Felix (Vegan)');
    expect(formatName('emine (Swing Istanbul) küçükkalfa')).toBe('Emine (Swing Istanbul) Küçükkalfa');
  });
});


describe('normalizePhoneNumber', () => {
  test('converts local format to international with grouping', () => {
    expect(normalizePhoneNumber('0176 1234567', '+49')).toBe('+49 176 1234567');
    expect(normalizePhoneNumber('01761234567', '+49')).toBe('+49 176 1234567');
  });

  test('reformats international numbers with consistent spacing', () => {
    expect(normalizePhoneNumber('+49 (176) 123-4567', '+49')).toBe('+49 176 1234567');
    expect(normalizePhoneNumber('+49-176-1234567', '+49')).toBe('+49 176 1234567');
    expect(normalizePhoneNumber('+49 176 1234567', '+49')).toBe('+49 176 1234567');
    expect(normalizePhoneNumber('+491761234567', '+49')).toBe('+49 176 1234567');
  });

  test('leaves unknown formats unchanged', () => {
    expect(normalizePhoneNumber('1234567', '+49')).toBe('1234567');
    expect(normalizePhoneNumber('abc', '+49')).toBe('abc');
  });

  test('works with different country codes', () => {
    expect(normalizePhoneNumber('0201234567', '+1')).toBe('+1 201 234567');
    expect(normalizePhoneNumber('07911123456', '+44')).toBe('+44 791 1123456');
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
    global.nameFormatterConfig.dryRun = true; global.phoneNormalizerConfig.dryRun = true; global.instagramToWebsiteConfig.dryRun = true; global.messengerToWebsiteConfig.dryRun = true; global.autoLabelConfig.dryRun = true;
    // Mock fetchContacts to return test data
    const origFetch = global.fetchContacts;
    global.fetchContacts = () => [new Contact('john doe', null)];

    const result = runNameFormatter();
    expect(result.fixed).toBe(1);

    global.fetchContacts = origFetch;
    global.nameFormatterConfig.dryRun = false; global.phoneNormalizerConfig.dryRun = false; global.instagramToWebsiteConfig.dryRun = false; global.messengerToWebsiteConfig.dryRun = false; global.autoLabelConfig.dryRun = false;
  });
});


describe('runPhoneNormalizer', () => {
  test('runs without errors in dry run', () => {
    global.nameFormatterConfig.dryRun = true; global.phoneNormalizerConfig.dryRun = true; global.instagramToWebsiteConfig.dryRun = true; global.messengerToWebsiteConfig.dryRun = true; global.autoLabelConfig.dryRun = true;
    const origFetch = global.fetchContacts;
    global.fetchContacts = () => [new Contact('Test', null, [], '', '', '0176 1234567')];

    const result = runPhoneNormalizer();
    expect(result.normalized).toBe(1);

    global.fetchContacts = origFetch;
    global.nameFormatterConfig.dryRun = false; global.phoneNormalizerConfig.dryRun = false; global.instagramToWebsiteConfig.dryRun = false; global.messengerToWebsiteConfig.dryRun = false; global.autoLabelConfig.dryRun = false;
  });
});


describe('matchesAutoLabelRule with regex', () => {
  test('matches regex pattern', () => {
    const contact = new Contact('Anna (Swing Barcelona) Castellví', null);
    expect(matchesAutoLabelRule(contact, { field: 'name', matches: '\\(swing .+\\)', label: 'Swing Festivals' })).toBe(true);
  });

  test('matches simple regex', () => {
    const contact = new Contact('Florian (Swing)', null);
    expect(matchesAutoLabelRule(contact, { field: 'name', matches: '\\(swing\\)', label: 'Swing' })).toBe(true);
  });

  test('does not match when pattern is absent', () => {
    const contact = new Contact('Normal Name', null);
    expect(matchesAutoLabelRule(contact, { field: 'name', matches: '\\(swing\\)', label: 'Swing' })).toBe(false);
  });

  test('handles invalid regex gracefully', () => {
    const contact = new Contact('Test', null);
    expect(matchesAutoLabelRule(contact, { field: 'name', matches: '[invalid', label: 'X' })).toBe(false);
  });

  test('is case-insensitive', () => {
    const contact = new Contact('Anna (VEGAN)', null);
    expect(matchesAutoLabelRule(contact, { field: 'name', matches: '\\(vegan\\)', label: 'Vegan' })).toBe(true);
  });
});


describe('detectCountryCodeLength', () => {
  test('detects 1-digit codes', () => {
    expect(detectCountryCodeLength('16171234567')).toBe(1);  // +1 US
    expect(detectCountryCodeLength('79161234567')).toBe(1);  // +7 Russia
  });

  test('detects 2-digit codes', () => {
    expect(detectCountryCodeLength('491761234567')).toBe(2);  // +49 Germany
    expect(detectCountryCodeLength('447911123456')).toBe(2);  // +44 UK
    expect(detectCountryCodeLength('905551234567')).toBe(2);  // +90 Turkey
    expect(detectCountryCodeLength('34612345678')).toBe(2);   // +34 Spain
    expect(detectCountryCodeLength('20123456789')).toBe(2);   // +20 Egypt
  });

  test('detects 3-digit codes', () => {
    expect(detectCountryCodeLength('972501234567')).toBe(3);  // +972 Israel
    expect(detectCountryCodeLength('3531234567')).toBe(3);    // +353 Ireland
    expect(detectCountryCodeLength('3561234567')).toBe(3);    // +356 Malta
  });
});


describe('runInstagramToWebsite', () => {
  test('runs without errors in dry run', () => {
    global.nameFormatterConfig.dryRun = true; global.phoneNormalizerConfig.dryRun = true; global.instagramToWebsiteConfig.dryRun = true; global.messengerToWebsiteConfig.dryRun = true; global.autoLabelConfig.dryRun = true;
    const origFetch = global.fetchContacts;
    global.fetchContacts = () => [
      new Contact('Test User', null, [], 'test@example.com', '', '', ['@testuser'], 'people/c123', '@testuser', [])
    ];

    const result = runInstagramToWebsite();
    expect(result.converted).toBe(1);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].name).toBe('Test User');
    expect(result.changes[0].urls[0]).toContain('instagram.com/testuser');

    global.fetchContacts = origFetch;
    global.nameFormatterConfig.dryRun = false; global.phoneNormalizerConfig.dryRun = false; global.instagramToWebsiteConfig.dryRun = false; global.messengerToWebsiteConfig.dryRun = false; global.autoLabelConfig.dryRun = false;
  });

  test('skips contacts that already have the Instagram URL', () => {
    global.nameFormatterConfig.dryRun = true; global.phoneNormalizerConfig.dryRun = true; global.instagramToWebsiteConfig.dryRun = true; global.messengerToWebsiteConfig.dryRun = true; global.autoLabelConfig.dryRun = true;
    const origFetch = global.fetchContacts;
    global.fetchContacts = () => [
      new Contact('Already Done', null, [], '', '', '', ['@existing'], 'people/c456', '@existing',
        [{ value: 'https://www.instagram.com/existing', type: 'other', formattedType: 'Instagram' }])
    ];

    const result = runInstagramToWebsite();
    expect(result.converted).toBe(0);
    expect(result.skipped).toBe(1);

    global.fetchContacts = origFetch;
    global.nameFormatterConfig.dryRun = false; global.phoneNormalizerConfig.dryRun = false; global.instagramToWebsiteConfig.dryRun = false; global.messengerToWebsiteConfig.dryRun = false; global.autoLabelConfig.dryRun = false;
  });

  test('skips contacts with no handles in notes', () => {
    global.nameFormatterConfig.dryRun = true; global.phoneNormalizerConfig.dryRun = true; global.instagramToWebsiteConfig.dryRun = true; global.messengerToWebsiteConfig.dryRun = true; global.autoLabelConfig.dryRun = true;
    const origFetch = global.fetchContacts;
    // Contact has Instagram from URL field only (not from notes)
    global.fetchContacts = () => [
      new Contact('URL Only', null, [], '', '', '', ['@fromurl'], 'people/c789', '',
        [{ value: 'https://www.instagram.com/fromurl' }])
    ];

    const result = runInstagramToWebsite();
    expect(result.converted).toBe(0);

    global.fetchContacts = origFetch;
    global.nameFormatterConfig.dryRun = false; global.phoneNormalizerConfig.dryRun = false; global.instagramToWebsiteConfig.dryRun = false; global.messengerToWebsiteConfig.dryRun = false; global.autoLabelConfig.dryRun = false;
  });
});


describe('runMessengerToWebsite', () => {
  test('converts FB: username to m.me website in dry run', () => {
    global.nameFormatterConfig.dryRun = true; global.phoneNormalizerConfig.dryRun = true; global.instagramToWebsiteConfig.dryRun = true; global.messengerToWebsiteConfig.dryRun = true; global.autoLabelConfig.dryRun = true;
    const origFetch = global.fetchContacts;
    global.fetchContacts = () => [
      new Contact('FB User', null, [], '', '', '', [], 'people/c100', 'FB: john.doe', [])
    ];

    const result = runMessengerToWebsite();
    expect(result.converted).toBe(1);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].name).toBe('FB User');
    expect(result.changes[0].urls[0]).toBe('https://m.me/john.doe');

    global.fetchContacts = origFetch;
    global.nameFormatterConfig.dryRun = false; global.phoneNormalizerConfig.dryRun = false; global.instagramToWebsiteConfig.dryRun = false; global.messengerToWebsiteConfig.dryRun = false; global.autoLabelConfig.dryRun = false;
  });

  test('converts Messenger: username pattern', () => {
    global.nameFormatterConfig.dryRun = true; global.phoneNormalizerConfig.dryRun = true; global.instagramToWebsiteConfig.dryRun = true; global.messengerToWebsiteConfig.dryRun = true; global.autoLabelConfig.dryRun = true;
    const origFetch = global.fetchContacts;
    global.fetchContacts = () => [
      new Contact('Msg User', null, [], '', '', '', [], 'people/c101', 'Messenger: cool_user', [])
    ];

    const result = runMessengerToWebsite();
    expect(result.converted).toBe(1);
    expect(result.changes[0].urls[0]).toBe('https://m.me/cool_user');

    global.fetchContacts = origFetch;
    global.nameFormatterConfig.dryRun = false; global.phoneNormalizerConfig.dryRun = false; global.instagramToWebsiteConfig.dryRun = false; global.messengerToWebsiteConfig.dryRun = false; global.autoLabelConfig.dryRun = false;
  });

  test('skips contacts that already have m.me URL', () => {
    global.nameFormatterConfig.dryRun = true; global.phoneNormalizerConfig.dryRun = true; global.instagramToWebsiteConfig.dryRun = true; global.messengerToWebsiteConfig.dryRun = true; global.autoLabelConfig.dryRun = true;
    const origFetch = global.fetchContacts;
    global.fetchContacts = () => [
      new Contact('Already Done', null, [], '', '', '', [], 'people/c102', 'FB: existing',
        [{ value: 'https://m.me/existing', type: 'other', formattedType: 'Messenger' }])
    ];

    const result = runMessengerToWebsite();
    expect(result.converted).toBe(0);
    expect(result.skipped).toBe(1);

    global.fetchContacts = origFetch;
    global.nameFormatterConfig.dryRun = false; global.phoneNormalizerConfig.dryRun = false; global.instagramToWebsiteConfig.dryRun = false; global.messengerToWebsiteConfig.dryRun = false; global.autoLabelConfig.dryRun = false;
  });

  test('skips contacts with just a tag and no username', () => {
    global.nameFormatterConfig.dryRun = true; global.phoneNormalizerConfig.dryRun = true; global.instagramToWebsiteConfig.dryRun = true; global.messengerToWebsiteConfig.dryRun = true; global.autoLabelConfig.dryRun = true;
    const origFetch = global.fetchContacts;
    global.fetchContacts = () => [
      new Contact('Tag Only', null, [], '', '', '', [], 'people/c103', 'FB', [])
    ];

    const result = runMessengerToWebsite();
    expect(result.converted).toBe(0);
    expect(result.changes).toHaveLength(0);

    global.fetchContacts = origFetch;
    global.nameFormatterConfig.dryRun = false; global.phoneNormalizerConfig.dryRun = false; global.instagramToWebsiteConfig.dryRun = false; global.messengerToWebsiteConfig.dryRun = false; global.autoLabelConfig.dryRun = false;
  });

  test('skips contacts with facebook.com URL for same username', () => {
    global.nameFormatterConfig.dryRun = true; global.phoneNormalizerConfig.dryRun = true; global.instagramToWebsiteConfig.dryRun = true; global.messengerToWebsiteConfig.dryRun = true; global.autoLabelConfig.dryRun = true;
    const origFetch = global.fetchContacts;
    global.fetchContacts = () => [
      new Contact('FB Link', null, [], '', '', '', [], 'people/c104', 'Facebook: myuser',
        [{ value: 'https://www.facebook.com/myuser' }])
    ];

    const result = runMessengerToWebsite();
    expect(result.converted).toBe(0);
    expect(result.skipped).toBe(1);

    global.fetchContacts = origFetch;
    global.nameFormatterConfig.dryRun = false; global.phoneNormalizerConfig.dryRun = false; global.instagramToWebsiteConfig.dryRun = false; global.messengerToWebsiteConfig.dryRun = false; global.autoLabelConfig.dryRun = false;
  });

  test('returns zeros when no contacts have messenger usernames', () => {
    global.nameFormatterConfig.dryRun = true; global.phoneNormalizerConfig.dryRun = true; global.instagramToWebsiteConfig.dryRun = true; global.messengerToWebsiteConfig.dryRun = true; global.autoLabelConfig.dryRun = true;
    const origFetch = global.fetchContacts;
    global.fetchContacts = () => [
      new Contact('Normal', null, [], '', '', '', [], 'people/c105', 'Just some notes', [])
    ];

    const result = runMessengerToWebsite();
    expect(result.converted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.changes).toHaveLength(0);

    global.fetchContacts = origFetch;
    global.nameFormatterConfig.dryRun = false; global.phoneNormalizerConfig.dryRun = false; global.instagramToWebsiteConfig.dryRun = false; global.messengerToWebsiteConfig.dryRun = false; global.autoLabelConfig.dryRun = false;
  });
});
