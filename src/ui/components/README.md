# UI Components

This directory contains UI component submodules. Each submodule should:

1. Communicate only through the global event bus
2. Be independently developable 
3. Follow the established patterns

## Structure

```
components/
├── component1/
│   ├── index.ts
│   ├── Component1.tsx
│   └── component1.types.ts
├── component2/
│   ├── index.ts
│   ├── Component2.tsx
│   └── component2.types.ts
└── ...
```

## Event Bus Usage

Components should:
- Listen to relevant events using `eventBus.on()`
- Emit events using `eventBus.emit()`
- Clean up listeners in useEffect cleanup functions