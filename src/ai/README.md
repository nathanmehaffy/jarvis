# Jarvis AI System

This is the AI component of the Jarvis project that converts natural language text commands into structured tasks and executes them using available tools.

## Architecture

```
Text Input → TaskParser → ToolExecutor → Event Bus → UI
             (Cerebras)    (Local)       (Events)
```

## Components

### 1. TaskParser (`taskParser.ts`)
- Converts natural language text to structured tasks using Cerebras API
- Includes fallback parsing for simple commands when Cerebras is unavailable
- Handles complex multi-command inputs

### 2. ToolExecutor (`toolExecutor.ts`)
- Executes parsed tasks using available tools
- Emits events to the UI via the event bus
- Manages tool parameter validation and error handling

### 3. CerebrasClient (`cerebrasClient.ts`)
- Handles communication with Cerebras API
- Manages API requests, authentication, and error handling
- Configurable model and parameters

### 4. Tools (`tools.ts`)
- Defines available tools (currently: open_window, close_window)
- Tool schema definitions for Cerebras function calling
- Tool discovery and validation utilities

### 5. AIManager (`AIManager.ts`)
- Main interface for the AI system
- Manages the AI worker thread
- Provides methods for processing text commands

### 6. AI Worker (`aiWorker.ts`)
- Web Worker for non-blocking AI processing
- Coordinates TaskParser and ToolExecutor
- Handles different message types and error scenarios

### 7. Tester (`tester.ts`)
- Comprehensive testing utilities for the AI system
- Predefined test commands and interactive testing
- Event monitoring and debugging tools

## Setup

### Prerequisites
1. Cerebras API key (set as `CEREBRAS_API_KEY` environment variable)
2. Node.js and npm/pnpm installed

### Configuration
Create a `.env.local` file in the project root:
```
CEREBRAS_API_KEY=your_cerebras_api_key_here
```

## Usage

### Basic Text Command Processing
```typescript
import { aiManager } from '@/ai';

// Initialize the AI manager
await aiManager.initialize();

// Process a text command
aiManager.processTextCommand("open a sticky note saying 'Hello World'");

// Listen for results
eventBus.on('ai:text_command_processed', (result) => {
  console.log('Command processed:', result);
});
```

### Using Individual Components
```typescript
import { TaskParser, ToolExecutor } from '@/ai';

const parser = new TaskParser();
const executor = new ToolExecutor();

// Parse text to tasks
const result = await parser.parseTextToTasks("create a notification window");

// Execute tasks
const executionResults = await executor.executeTasks(result.tasks);
```

### Testing
```typescript
import { aiTester } from '@/ai';

// Run all predefined tests
await aiTester.runTests();

// Test a specific command
await aiTester.testCommand("open a settings dialog");

// Interactive testing (also available in browser console as window.aiTester)
aiTester.interactive();
```

## Available Tools

### open_window
Opens a new popup window with specified type and context.

**Parameters:**
- `windowType`: string - Type of window (notification, dialog, settings, sticky-note, general)
- `context`: object - Window context information
  - `title`: string - Window title
  - `content`: string - Window content
  - `type`: string - Window type
  - `position`: {x, y} - Optional position
  - `size`: {width, height} - Optional size

**Example:**
```
"open a sticky note saying 'Buy groceries'"
```

### close_window
Closes an existing window by its ID.

**Parameters:**
- `windowId`: string - Unique identifier of the window to close

**Example:**
```
"close window window_123456"
```

## Event System

The AI system communicates with the UI through the event bus:

### Emitted Events
- `ai:text_command_processed` - When a text command is successfully processed
- `ai:error` - When an error occurs in AI processing
- `ui:open_window` - Instructs UI to open a window
- `ui:close_window` - Instructs UI to close a window
- `window:opened` - General window opened event
- `window:closed` - General window closed event

### Event Data Formats

**text_command_processed:**
```typescript
{
  id: string;
  success: boolean;
  originalText: string;
  tasks: Task[];
  executionResults: ExecutionResult[];
  processingTime: number;
  timestamp: number;
}
```

**ui:open_window:**
```typescript
{
  id: string;
  type: string;
  title: string;
  content: string;
  position: {x: number, y: number};
  size: {width: number, height: number};
  context: WindowContext;
  timestamp: number;
}
```

## Error Handling

The system includes comprehensive error handling:

1. **Cerebras API failures** - Falls back to rule-based parsing
2. **Invalid tool parameters** - Validates parameters before execution
3. **Network errors** - Graceful degradation with fallback parsing
4. **Worker errors** - Error propagation through event system

## Development

### Adding New Tools

1. Define the tool in `tools.ts`:
```typescript
{
  name: 'my_new_tool',
  description: 'Description of what the tool does',
  parameters: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Parameter description',
        required: true
      }
    },
    required: ['param1']
  }
}
```

2. Add execution logic in `toolExecutor.ts`:
```typescript
case 'my_new_tool':
  return await this.executeMyNewTool(task);
```

3. Update fallback parsing in `taskParser.ts` if needed

### Testing New Features

Use the comprehensive testing utilities:

```typescript
// Test individual commands
await aiTester.testCommand("your new command");

// Add to predefined tests in tester.ts
// Monitor events in real-time
aiTester.listenToEvents();
```

## Notes

- The AI system runs in a Web Worker to avoid blocking the main thread
- Cerebras API integration uses function calling for structured outputs
- Fallback parsing ensures the system works even without API access
- All components are modular and can be used independently
- Event-driven architecture allows for loose coupling with UI components
