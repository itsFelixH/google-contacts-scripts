/**
 * Tests for Contact class and contact_manager functions.
 * These run in the Apps Script environment via runContactManagerTests().
 */

function testContactBirthdayHandling() {
  // Test contact with valid birthday
  const contact1 = new Contact('Valid Birthday', new Date('1990-01-01'), []);
  assert(contact1.getBirthday() instanceof Date, 'Birthday should be a Date object');
  assertEquals(contact1.getBirthdayShortFormat(), '01.01.', 'Birthday short format should match');
  assertEquals(contact1.getBirthdayLongFormat(), '01.01.1990', 'Birthday long format should match');

  // Test contact with null birthday
  const contact2 = new Contact('No Birthday', null, []);
  assertEquals(contact2.getBirthday(), null, 'Birthday should be null');
  assertEquals(contact2.getBirthdayShortFormat(), '', 'Birthday short format should be empty');
  assertEquals(contact2.getBirthdayLongFormat(), '', 'Birthday long format should be empty');

  // Test contact with empty string birthday
  const contact3 = new Contact('Empty Birthday', '', []);
  assertEquals(contact3.getBirthday(), null, 'Birthday should be null');
}

function testContactCreation() {
  const contact = new Contact(
    'John Doe',
    new Date('1990-01-01'),
    ['Friends', 'Work'],
    'john@example.com',
    'Berlin',
    '+1234567890',
    ['@johndoe']
  );

  assertEquals(contact.getName(), 'John Doe', 'Name should match');
  assertArrayEquals(contact.getLabels(), ['Friends', 'Work'], 'Labels should match');
  assertEquals(contact.email, 'john@example.com', 'Email should match');
  assertEquals(contact.city, 'Berlin', 'City should match');
  assertEquals(contact.phoneNumber, '+1234567890', 'Phone number should match');
  assertArrayEquals(contact.instagramNames, ['@johndoe'], 'Instagram names should match');
}

function testContactAgeCalculation() {
  const today = new Date();
  const birthYear = today.getFullYear() - 30;
  const contact = new Contact('Jane Doe', new Date(birthYear, 0, 1), []);

  assertEquals(contact.calculateAge(), 30, 'Age calculation should be correct');
  assert(contact.hasKnownBirthYear(), 'Should have known birth year');
}

function testContactSocialLinks() {
  const contact = new Contact(
    'Social User', new Date(), [], '', '', '1234567890', ['@social_user', '@another_account']
  );

  assertEquals(contact.getWhatsAppLink(), 'https://wa.me/1234567890', 'WhatsApp link should be correct');
  assertArrayEquals(
    contact.getAllInstagramLinks(),
    ['https://www.instagram.com/social_user/', 'https://www.instagram.com/another_account/'],
    'Instagram links should be correct'
  );
}

function testContactLink() {
  const contact = new Contact('Test', new Date(), [], '', '', '', [], 'people/c12345');
  assertEquals(contact.getContactLink(), 'https://contacts.google.com/person/c12345', 'Contact link should be correct');

  const noResource = new Contact('Test2', new Date(), []);
  assertEquals(noResource.getContactLink(), '', 'No resource should return empty string');
}

function testContactValidation() {
  // Test contact creation with missing name
  try {
    new Contact('', new Date());
    throw new Error('Should have thrown error for missing name');
  } catch (e) {
    assert(e.message.includes('required'), 'Should throw error about required name');
  }

  // Test contact with invalid labels
  const contact = new Contact('Test User', new Date(), 'invalid');
  assertArrayEquals(contact.getLabels(), [], 'Invalid labels should be converted to empty array');
}

function testFindContactsWithoutLabels() {
  const contacts = [
    new Contact('No Labels', new Date()),
    new Contact('Has Labels', new Date(), ['Friends']),
    new Contact('Also No Labels', new Date(), [])
  ];

  const result = findContactsWithoutLabels(contacts);
  assertEquals(result.length, 2, 'Should find 2 contacts without labels');
  assertEquals(result[0].getName(), 'No Labels', 'First should match');
  assertEquals(result[1].getName(), 'Also No Labels', 'Second should match');
}

function testFindContactsWithoutBirthday() {
  const contacts = [
    new Contact('No Birthday', null),
    new Contact('Has Birthday', new Date('1990-01-01')),
    new Contact('Also No Birthday', '')
  ];

  const result = findContactsWithoutBirthday(contacts);
  assertEquals(result.length, 2, 'Should find 2 contacts without birthdays');
}

function testFindContactsWithLabel() {
  const contacts = [
    new Contact('Friend 1', new Date(), ['Friends']),
    new Contact('Work Contact', new Date(), ['Work']),
    new Contact('Friend 2', new Date(), ['Friends', 'Work'])
  ];

  const friends = findContactsWithLabel(contacts, 'Friends');
  assertEquals(friends.length, 2, 'Should find 2 contacts with Friends label');

  const work = findContactsWithLabel(contacts, 'Work');
  assertEquals(work.length, 2, 'Should find 2 contacts with Work label');

  const none = findContactsWithLabel(contacts, 'NonExistent');
  assertEquals(none.length, 0, 'Should find 0 contacts with non-existent label');
}

function testFindContactsWithUpcomingBirthdays() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const twoWeeks = new Date(today);
  twoWeeks.setDate(today.getDate() + 14);

  const contacts = [
    new Contact('Tomorrow Birthday', tomorrow),
    new Contact('Next Week Birthday', nextWeek),
    new Contact('Two Weeks Birthday', twoWeeks)
  ];

  const upcoming7 = findContactsWithUpcomingBirthdays(contacts, 7);
  assertEquals(upcoming7.length, 2, 'Should find 2 contacts with birthdays in next 7 days');

  const upcoming14 = findContactsWithUpcomingBirthdays(contacts, 14);
  assertEquals(upcoming14.length, 3, 'Should find 3 contacts with birthdays in next 14 days');
}

function testFindContactsWithInvalidPhones() {
  const contacts = [
    new Contact('Valid Phone', new Date(), [], '', '', '+1234567890'),
    new Contact('Invalid Phone', new Date(), [], '', '', 'abc123'),
    new Contact('No Phone', new Date()),
    new Contact('Another Invalid', new Date(), [], '', '', '12.34.56')
  ];

  const invalid = findContactsWithInvalidPhones(contacts);
  assertEquals(invalid.length, 1, 'Should find 1 contact with invalid phone');
  assertEquals(invalid[0].getName(), 'Invalid Phone', 'Invalid phone contact should match');
}

function testFindContactsWithoutSurnames() {
  const contacts = [
    new Contact('John', new Date()),
    new Contact('John Doe', new Date()),
    new Contact('Jane', new Date()),
    new Contact('Jane Smith', new Date())
  ];

  const result = findContactsWithoutSurnames(contacts);
  assertEquals(result.length, 2, 'Should find 2 contacts without surnames');
  assertEquals(result[0].getName(), 'John', 'First should be John');
  assertEquals(result[1].getName(), 'Jane', 'Second should be Jane');
}

function testFindPotentialDuplicates() {
  const contacts = [
    new Contact('John Doe', new Date(), [], 'john@test.com'),
    new Contact('John Doe', new Date(), [], 'different@test.com'),
    new Contact('Jane Smith', new Date())
  ];

  const duplicates = findPotentialDuplicates(contacts);
  assertEquals(duplicates.length, 1, 'Should find 1 duplicate group');
  assertEquals(duplicates[0].count, 2, 'Duplicate group should have 2 contacts');
}

function testGenerateContactStats() {
  const contacts = [
    new Contact('Complete', new Date('1990-01-01'), ['Friends', 'Work'], 'test@example.com', 'Berlin', '+1234567890', ['@social']),
    new Contact('Minimal', null, []),
    new Contact('Partial', new Date('1985-06-15'), ['Friends'], 'test2@example.com')
  ];

  const stats = generateContactStats(contacts);

  assertEquals(stats.totalContacts, 3, 'Total contacts should be 3');
  assertEquals(stats.withBirthday, 2, 'Contacts with birthday should be 2');
  assertEquals(stats.withEmail, 2, 'Contacts with email should be 2');
  assertEquals(stats.withPhone, 1, 'Contacts with phone should be 1');
  assertEquals(stats.withCity, 1, 'Contacts with city should be 1');
  assertEquals(stats.withLabels, 2, 'Contacts with labels should be 2');
  assertEquals(stats.withInstagram, 1, 'Contacts with Instagram should be 1');
  assertEquals(stats.labelDistribution['Friends'], 2, 'Should have 2 Friends');
  assertEquals(stats.labelDistribution['Work'], 1, 'Should have 1 Work');
}

function testExtractInstagramNamesFromNotes() {
  // Test @username pattern
  const result1 = extractInstagramNamesFromNotes('Follow me @johndoe on Instagram');
  assertArrayEquals(result1, ['@johndoe'], 'Should extract @username');

  // Test multiple usernames
  const result2 = extractInstagramNamesFromNotes('@user1 and @user2');
  assertArrayEquals(result2, ['@user1', '@user2'], 'Should extract multiple usernames');

  // Test "Instagram: username" pattern
  const result3 = extractInstagramNamesFromNotes('Instagram: cooluser');
  assertArrayEquals(result3, ['@cooluser'], 'Should extract Instagram: pattern');

  // Test empty/null
  assertEquals(extractInstagramNamesFromNotes('').length, 0, 'Empty should return empty');
  assertEquals(extractInstagramNamesFromNotes(null).length, 0, 'Null should return empty');
}

function runContactManagerTests() {
  const tests = [
    testContactBirthdayHandling,
    testContactCreation,
    testContactAgeCalculation,
    testContactSocialLinks,
    testContactLink,
    testContactValidation,
    testFindContactsWithoutLabels,
    testFindContactsWithoutBirthday,
    testFindContactsWithLabel,
    testFindContactsWithUpcomingBirthdays,
    testFindContactsWithInvalidPhones,
    testFindContactsWithoutSurnames,
    testFindPotentialDuplicates,
    testGenerateContactStats,
    testExtractInstagramNamesFromNotes
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test();
      Logger.log(`✅ ${test.name} passed`);
      passed++;
    } catch (e) {
      Logger.log(`❌ ${test.name} failed: ${e.message}`);
      failed++;
    }
  }

  Logger.log(`\nTest Summary: ${passed} passed, ${failed} failed out of ${tests.length}`);
}
