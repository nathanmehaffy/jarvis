# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Development server**: `pnpm run dev` (uses Next.js with Turbopack)
- **Build**: `pnpm run build` (production build with Turbopack)
- **Start production**: `pnpm run start`
- **Lint**: `pnpm run lint` (ESLint with Next.js TypeScript config)

## Architecture

This is a Next.js project implementing an event-driven architecture with three isolated components that communicate only through a global event bus:

### Core Components
- **Input** (`src/input/`): Handles input processing with a web worker
- **AI** (`src/ai/`): Manages AI operations with a web worker
- **UI** (`src/ui/`): React components and user interface

### Event Bus System
The global event bus (`src/lib/eventBus.ts`) is the central communication mechanism:
- All components communicate via events, not direct imports
- Event naming convention: `{component}:{action}` (e.g., `input:input_processed`, `ai:response_generated`)
- Components should clean up event listeners in useEffect cleanup functions

### Component Structure
Each component follows this pattern:
- Manager class (e.g., `InputManager.ts`, `AIManager.ts`)
- Web worker for async processing
- Public exports through `index.ts`

### UI Component Guidelines
UI components in `src/ui/components/` should:
- Follow the submodule structure: `componentName/index.ts`, `ComponentName.tsx`, `componentName.types.ts`
- Communicate only through the event bus
- Be independently developable

## Technical Stack
- **Framework**: Next.js 15.5.3 with App Router
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS v4
- **Package Manager**: pnpm
- **Build Tool**: Turbopack (Next.js built-in)
- **Linting**: ESLint with Next.js TypeScript rules

## Path Aliases
Use `@/*` for imports from `src/` directory (configured in tsconfig.json).