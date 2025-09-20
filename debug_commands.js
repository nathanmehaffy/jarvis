// Debug commands to test in browser console
// After opening the app, paste these into the browser console:

console.log("=== Testing AI Command Parsing ===");

// Test 1: Simple content
console.log("\n1. Testing: 'open a window saying cheese'");
aiTester.testCommand("open a window saying cheese");

// Test 2: Multiple windows
console.log("\n2. Testing: 'open 7 windows saying hello'");
aiTester.testCommand("open 7 windows saying hello");

// Test 3: Close window
console.log("\n3. Testing: 'close window'");
aiTester.testCommand("close window");

// Test 4: Close all windows
console.log("\n4. Testing: 'close all windows'");
aiTester.testCommand("close all windows");

// Test 5: Check if fallback parsing is being used
console.log("\n5. Manual fallback test:");
// This will test the TaskParser directly
