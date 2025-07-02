const assert = function (condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
};

const assertEquals = function (actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
};

const assertArrayEquals = function (actual, expected, message) {
  if (actual.length !== expected.length) {
    throw new Error(message || `Arrays have different lengths. Expected ${expected.length} but got ${actual.length}`);
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(message || `Arrays differ at index ${i}. Expected ${expected[i]} but got ${actual[i]}`);
    }
  }
};