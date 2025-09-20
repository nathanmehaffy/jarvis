# Jarvis - Event-Driven Architecture

Clean, minimal Next.js project with event-driven architecture using a global event bus.

## Architecture

The project is partitioned into three main components that communicate only through the global event bus:

- **Input** (`src/input/`) - Handles input processing with webworker
- **AI** (`src/ai/`) - Manages AI operations with webworker  
- **UI** (`src/ui/`) - React components and user interface

## Directory Structure

```
src/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main page (instantiates MainUI)
│   └── layout.tsx         # Root layout
├── input/                 # Input component
│   ├── InputManager.ts    # Main input manager class
│   ├── inputWorker.ts     # Web worker for async processing
│   └── index.ts          # Public exports
├── ai/                    # AI component  
│   ├── AIManager.ts       # Main AI manager class
│   ├── aiWorker.ts        # Web worker for async processing
│   └── index.ts          # Public exports
├── ui/                    # UI component
│   ├── MainUI.tsx         # Main UI component
│   ├── components/        # UI submodules directory
│   │   └── README.md      # Component development guide
│   └── index.ts          # Public exports
└── lib/                   # Shared utilities
    └── eventBus.ts        # Global event bus implementation
```

## Event Bus

The global event bus (`src/lib/eventBus.ts`) provides:

- `on(event, callback)` - Subscribe to events
- `off(event, callback)` - Unsubscribe from events  
- `emit(event, data)` - Emit events
- `once(event, callback)` - Subscribe once
- `clear()` - Clear all listeners

## Component Communication

All components communicate through events:

- Input events: `input:*` (e.g., `input:input_processed`)
- AI events: `ai:*` (e.g., `ai:response_generated`)
- UI events: `ui:*` (for future UI-specific events)

## Development

Each component can be developed independently:

1. **Input**: Add processing logic to `InputManager.ts` and `inputWorker.ts`
2. **AI**: Add AI logic to `AIManager.ts` and `aiWorker.ts`  
3. **UI**: Add components to `src/ui/components/` following the README guide

## Getting Started

```bash
npm install
npm run dev
```

The application will initialize both webworkers and demonstrate the event bus communication with test buttons.