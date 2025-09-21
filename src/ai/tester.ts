/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AI System Tester
 * 
 * This is a basic testing utility for the Jarvis AI system.
 * It allows you to test text commands and see how they get parsed into tasks
 * and executed by the tool system.
 * 
 * Usage:
 * - Import this file and call runTests() to run predefined tests
 * - Use testCommand(text) to test individual commands
 * - Use listenToEvents() to see real-time AI processing events
 */

import { TaskParser } from './taskParser';
import { ToolExecutor } from './toolExecutor';
import { eventBus } from '@/lib/eventBus';

export class AITester {
  private taskParser: TaskParser;
  private toolExecutor: ToolExecutor;
  private eventListeners: (() => void)[] = [];
  private requestQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.taskParser = new TaskParser();
    this.toolExecutor = new ToolExecutor();
  }

  /**
   * Test a single text command with optional context simulation
   */
  async testCommand(text: string, options?: { uiContext?: any; actionHistory?: Array<{ tool: string; parameters: any; sourceText: string }> }): Promise<void> {
    this.requestQueue = this.requestQueue.then(async () => {
      console.log(`\n🧪 Testing command: "${text}"`);
      console.log('─'.repeat(50));

      // Use provided context or simulate realistic defaults
      const uiContext = options?.uiContext || {
        windows: [
          { id: 'win_notes', title: 'My Notes', type: 'sticky-note' },
          { id: 'win_tasks', title: 'Task List', type: 'tasks' },
          { id: 'win_search', title: 'Search Results', type: 'search' }
        ]
      };
      const actionHistory = options?.actionHistory || [];

      console.log('📝 Parsing command with simulated context...');
      console.log('UI Context:', uiContext);
      if (actionHistory.length > 0) {
        console.log('Action History:', actionHistory);
      }

      try {
        // Parse the command (may use Cerebras; fallback handles offline/rate limits)
        const parseResult = await this.taskParser.parseTextToTasks({ transcript: text, actionHistory, uiContext });

        // New parser always returns { new_tool_calls }

        console.log(`✅ Parsed ${parseResult.new_tool_calls.length} tool call(s):`);
        parseResult.new_tool_calls.forEach((call, index) => {
          console.log(`   ${index + 1}. ${call.tool}`);
          console.log(`      Parameters:`, call.parameters);
          console.log(`      Source:`, call.sourceText);
        });

        // Execute the tasks
        console.log('\n⚡ Executing tasks...');
        const executionResults = await this.toolExecutor.executeTasks(parseResult.new_tool_calls.map((c, i) => ({ id: `test_${i}`, tool: c.tool, parameters: c.parameters, description: c.tool })));

        executionResults.forEach((result, index) => {
          if (result.success) {
            console.log(`   ✅ Task ${index + 1} executed successfully`);
            if (result.result) {
              console.log(`      Result:`, result.result);
            }
          } else {
            console.log(`   ❌ Task ${index + 1} failed:`, result.error);
          }
        });

        console.log('─'.repeat(50));
        console.log('✨ Test completed\n');

      } catch (error) {
        console.error('💥 Test failed with error:', error);
      }
    });

    return this.requestQueue;
  }

  /**
   * Run a suite of predefined tests
   */
  async runTests(): Promise<void> {
    console.log('🚀 Starting AI System Tests');
    console.log('═'.repeat(60));

    const testCommands = [
      // Simple window operations
      'open a window',
      'create a sticky note',
      'close window window_123',
      
      // Complex commands
      'open a sticky note that says "Remember to buy groceries"',
      'create a notification window titled "Meeting Alert"',
      'open a settings dialog and close window abc123',
      
      // Edge cases
      'show me a "Project Ideas" sticky note',
      'close all windows', // Should close all open windows
      '', // Empty command
      
      // Natural language variations
      'I need a reminder note about the dentist appointment',
      'please open a window for the user settings',
      'dismiss window xyz789',

      // Education-focused commands
      'start lesson "Derivatives" step 1',
      'open a quiz titled "Chapter 3 Review"',
      'give me a hint about "Pythagorean theorem"',
      'explain "binary search" step by step',

      // Search commands
      'search for current economic policy',
      'find information about artificial intelligence',
      'look up the weather in New York',
      'research quantum computing advancements'
    ];

    for (const command of testCommands) {
      await this.testCommand(command);
      // Small delay between tests for readability
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('🎉 All tests completed!');
  }

  /**
   * Listen to AI events in real-time
   */
  listenToEvents(): void {
    console.log('👂 Listening to AI events...');
    
    // Clear existing listeners
    this.clearEventListeners();

    const unsubscribers = [
      eventBus.on('ai:text_command_processed', (data: any) => {
        console.log('🤖 Text command processed:', data);
      }),
      
      eventBus.on('ai:error', (error: any) => {
        console.error('🚨 AI Error:', error);
      }),
      
      eventBus.on('ui:open_window', (data: any) => {
        console.log('🪟 Window opened:', data);
      }),
      
      eventBus.on('ui:close_window', (data: any) => {
        console.log('🔲 Window closed:', data);
      }),
      
      eventBus.on('window:opened', (data: any) => {
        console.log('📊 Window event - opened:', data);
      }),
      
      eventBus.on('window:closed', (data: any) => {
        console.log('📊 Window event - closed:', data);
      }),

      eventBus.on('ai:searching', (data: any) => {
        console.log('🔍 Search started:', data);
      }),

      eventBus.on('ai:search_complete', (data: any) => {
        console.log('✅ Search completed:', data);
      })
    ];

    this.eventListeners = unsubscribers;
  }

  /**
   * Stop listening to events
   */
  clearEventListeners(): void {
    this.eventListeners.forEach(unsubscribe => unsubscribe());
    this.eventListeners = [];
  }

  /**
   * Test the Cerebras integration specifically
   */
  async testCerebrasIntegration(): Promise<void> {
    console.log('🧠 Testing Cerebras Integration');
    console.log('─'.repeat(40));

    try {
      const testText = 'open a sticky note saying "test cerebras"';
      console.log(`Testing with: "${testText}"`);
      
      const result = await this.taskParser.parseTextToTasks({ transcript: testText, actionHistory: [], uiContext: {} });
      
      if (Array.isArray(result.new_tool_calls)) {
        console.log('✅ Cerebras integration working');
        console.log('Calls created:', result.new_tool_calls.length);
      } else {
        console.log('⚠️ Cerebras integration failed, using fallback parsing');
        console.log('No calls created');
      }
    } catch (error) {
      console.error('❌ Cerebras test failed:', error);
    }
  }

  /**
   * Quick test for model verification
   */
  async testModelOnly(): Promise<void> {
    console.log('🔍 Testing Model Access');
    console.log('─'.repeat(30));
    
    try {
      const simpleText = 'hello';
      await this.taskParser.parseTextToTasks({ transcript: simpleText, actionHistory: [], uiContext: {} });
      console.log('✅ Model accessible.');
    } catch (error) {
      console.error('❌ Model test failed:', error);
    }
  }

  /**
   * Interactive testing - call this to test commands manually
   */
  async interactive(): Promise<void> {
    console.log('🎮 Interactive AI Testing Mode');
    console.log('Use aiTester.testCommand("your command") to test commands');
    console.log('Use aiTester.runTests() to run all predefined tests');
    console.log('Use aiTester.listenToEvents() to monitor events');
    
    // Start listening to events by default
    this.listenToEvents();
  }
}

// Create a global instance for easy testing
export const aiTester = new AITester();

// Auto-start interactive mode when this file is imported
if (typeof window !== 'undefined') {
  (window as any).aiTester = aiTester;
  // Expose the event bus for console-based inspection and custom listeners
  (window as any).eventBus = eventBus;
  console.log('🧪 AI Tester loaded! Use window.aiTester in browser console');
  console.log('🔌 EventBus exposed as window.eventBus');
}
