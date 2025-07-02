const assert = function(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
};

const assertEquals = function(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
};

const assertArrayEquals = function(actual, expected, message) {
  if (actual.length !== expected.length) {
    throw new Error(message || `Arrays have different lengths. Expected ${expected.length} but got ${actual.length}`);
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(message || `Arrays differ at index ${i}. Expected ${expected[i]} but got ${actual[i]}`);
    }
  }
};

function mockPeopleAPI() {
  // Mock the Google People API responses
  const mockLabels = [
    { resourceName: "contactGroups/123", name: "Friends" },
    { resourceName: "contactGroups/456", name: "Work" },
    { resourceName: "contactGroups/789", name: "Family" }
  ];

  global.People = {
    ContactGroups: {
      list: () => ({
        contactGroups: mockLabels
      }),
      batchGet: ({ resourceNames }) => ({
        responses: mockLabels.map(label => ({
          contactGroup: label
        }))
      }),
      create: ({ contactGroup }) => ({
        resourceName: "contactGroups/new",
        name: contactGroup.name
      })
    }
  };

  return mockLabels;
}

function testLabelManagerInitialization() {
  const mockLabels = mockPeopleAPI();
  const labelManager = new LabelManager();
  
  assertEquals(
    labelManager.labels.length,
    mockLabels.length,
    "Should initialize with correct number of labels"
  );
}

function testGetLabelNameById() {
  const labelManager = new LabelManager();

  // Test valid label ID
  const labelName = labelManager.getLabelNameById("contactGroups/123");
  assertEquals(labelName, "Friends", "Should return correct label name for valid ID");

  // Test invalid label ID
  const invalidLabel = labelManager.getLabelNameById("invalid");
  assertEquals(invalidLabel, null, "Should return null for invalid ID");

  // Test system labels
  assertEquals(
    labelManager.getLabelNameById("myContacts"),
    null,
    "Should return null for system label myContacts"
  );
  assertEquals(
    labelManager.getLabelNameById("starred"),
    null,
    "Should return null for system label starred"
  );
}

function testGetLabelNamesByIds() {
  const labelManager = new LabelManager();
  const labelIds = ["contactGroups/123", "contactGroups/456", "invalid"];
  const labelNames = labelManager.getLabelNamesByIds(labelIds);

  assertArrayEquals(
    labelNames,
    ["Friends", "Work"],
    "Should return array of valid label names only"
  );
}

function testLabelExistence() {
  const labelManager = new LabelManager();

  // Test by ID
  assert(
    labelManager.labelExistsById("contactGroups/123"),
    "Should find existing label by ID"
  );
  assert(
    !labelManager.labelExistsById("invalid"),
    "Should not find non-existent label by ID"
  );

  // Test by name
  assert(
    labelManager.labelExistsByName("Friends"),
    "Should find existing label by name"
  );
  assert(
    !labelManager.labelExistsByName("Invalid"),
    "Should not find non-existent label by name"
  );
}

function testAddLabel() {
  const labelManager = new LabelManager();
  const newLabel = labelManager.addLabel("New Group");

  assert(newLabel !== null, "Should successfully add new label");
  assertEquals(newLabel.name, "New Group", "New label should have correct name");
  assert(
    labelManager.labelExistsByName("New Group"),
    "New label should exist in manager"
  );
}

function runLabelManagerTests() {
  const tests = [
    testLabelManagerInitialization,
    testGetLabelNameById,
    testGetLabelNamesByIds,
    testLabelExistence,
    testAddLabel
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