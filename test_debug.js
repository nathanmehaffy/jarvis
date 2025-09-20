// Test debug script - run in browser console after loading the app

console.log("=== Debug Test for Multiple Windows and Close All ===");

// Test multiple windows parsing
async function testMultipleWindows() {
  console.log("\n--- Testing Multiple Windows ---");
  console.log("Command: 'open 7 windows saying cheese'");
  
  try {
    await aiTester.testCommand("open 7 windows saying cheese");
  } catch (e) {
    console.error("Error:", e);
  }
}

// Test close all windows
async function testCloseAll() {
  console.log("\n--- Testing Close All Windows ---");
  console.log("Command: 'close all windows'");
  
  try {
    await aiTester.testCommand("close all windows");
  } catch (e) {
    console.error("Error:", e);
  }
}

// Test window registry
function testWindowRegistry() {
  console.log("\n--- Testing Window Registry ---");
  console.log("Current windows in registry:", windowRegistry.getAll());
  console.log("Registry count:", windowRegistry.getAll().length);
}

// Run tests
console.log("Running tests...");
setTimeout(testMultipleWindows, 1000);
setTimeout(testCloseAll, 3000);
setTimeout(testWindowRegistry, 5000);
