function testContactCreation() {
  // Test basic contact creation
  const contact = new Contact(
    "John Doe",
    new Date("1990-01-01"),
    ["Friends", "Work"],
    "john@example.com",
    "Berlin",
    "+1234567890",
    ["@johndoe"]
  );

  assertEquals(contact.getName(), "John Doe", "Name should match");
  assertEquals(contact.getBirthdayShortFormat(), "01.01.", "Birthday short format should match");
  assertEquals(contact.getBirthdayLongFormat(), "01.01.1990", "Birthday long format should match");
  assertArrayEquals(contact.getLabels(), ["Friends", "Work"], "Labels should match");
  assertEquals(contact.email, "john@example.com", "Email should match");
  assertEquals(contact.city, "Berlin", "City should match");
  assertEquals(contact.phoneNumber, "+1234567890", "Phone number should match");
  assertArrayEquals(contact.instagramNames, ["@johndoe"], "Instagram names should match");
}

function testContactAgeCalculation() {
  const today = new Date();
  const birthYear = today.getFullYear() - 30;
  const contact = new Contact(
    "Jane Doe",
    new Date(birthYear, 0, 1), // January 1st, 30 years ago
    []
  );

  assertEquals(contact.calculateAge(), 30, "Age calculation should be correct");
  assert(contact.hasKnownBirthYear(), "Should have known birth year");
}

function testContactSocialLinks() {
  const contact = new Contact(
    "Social User",
    new Date(),
    [],
    "",
    "",
    "1234567890",
    ["@social_user", "@another_account"]
  );

  assertEquals(
    contact.getWhatsAppLink(),
    "https://wa.me/1234567890",
    "WhatsApp link should be correctly formatted"
  );

  assertArrayEquals(
    contact.getAllInstagramLinks(),
    [
      "https://www.instagram.com/social_user/",
      "https://www.instagram.com/another_account/"
    ],
    "Instagram links should be correctly formatted"
  );
}

function testContactValidation() {
  // Test contact creation with missing name
  try {
    new Contact("", new Date());
    throw new Error("Should have thrown error for missing name");
  } catch (e) {
    assert(e.message === "Name is required.", "Should throw correct error message");
  }

  // Test contact with invalid labels
  const contact = new Contact("Test User", new Date(), "invalid");
  assertArrayEquals(contact.getLabels(), [], "Invalid labels should be converted to empty array");
}

function testFindContactsWithoutLabels() {
  // Create a ContactManager instance
  const manager = new ContactManager();
  
  // Create test contacts with and without labels
  const contact1 = new Contact("No Labels", new Date());
  const contact2 = new Contact("Has Labels", new Date(), ["Friends"]);
  const contact3 = new Contact("Also No Labels", new Date(), []);
  
  // Mock the contacts array
  manager.contacts = [contact1, contact2, contact3];
  
  // Test finding contacts without labels
  const contactsWithoutLabels = manager.findContactsWithoutLabels();
  
  assertEquals(contactsWithoutLabels.length, 2, "Should find 2 contacts without labels");
  assertEquals(contactsWithoutLabels[0].getName(), "No Labels", "First contact without labels should match");
  assertEquals(contactsWithoutLabels[1].getName(), "Also No Labels", "Second contact without labels should match");
}

function runContactManagerTests() {
  const tests = [
    testContactCreation,
    testContactAgeCalculation,
    testContactSocialLinks,
    testContactValidation,
    testFindContactsWithoutLabels
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

  Logger.log(`\nTest Summary:`);
  Logger.log(`Total: ${tests.length}`);
  Logger.log(`Passed: ${passed}`);
  Logger.log(`Failed: ${failed}`);
}