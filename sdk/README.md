# Agent Bridge SDK

TypeScript SDK for Agent Bridge

## Installation

```bash
npm install @agent-bridge/sdk
```

## Quick Start

```typescript
import { AgentBridge } from '@agent-bridge/sdk';

const client = new AgentBridge({
  endpoint: 'https://api.agent-bridge.com',
  appKey: 'your-app-key',
  appSecret: 'your-app-secret'
});

// Create session
const session = await client.createSession({
  userId: 'user-123',
  topic: 'AI Writing Assistant'
});

// Stream skill execution
const stream = client.stream({
  sessionId: session.id,
  skillId: 'article_creation',
  input: { topic: 'AI Trends' },
  handlers: {
    onChunk: (chunk) => {
      console.log('Received:', chunk.content);
    },
    onWaitingInput: (data) => {
      console.log('Waiting for input:', data.prompt);
      // Show input dialog
    },
    onCompleted: (data) => {
      console.log('Completed:', data.output);
    },
    onFailed: (data) => {
      console.error('Failed:', data.error);
    },
    onDisconnected: () => {
      console.log('Disconnected, will auto-reconnect...');
    },
    onReconnected: () => {
      console.log('Reconnected!');
    }
  }
});

// Submit user input when requested
stream.submitInput({ content: 'user input here' });

// Cancel if needed
stream.cancel();
```

## API Reference

### Sessions

- `createSession(params)` - Create new session
- `getSession(sessionId)` - Get session by ID
- `listSessions(params)` - List user sessions

### Runs

- `createRun(params)` - Create new run (sync)
- `getRun(runId)` - Get run status
- `cancelRun(runId)` - Cancel run
- `submitInput(params)` - Submit user input

### Stream

- `stream(params)` - Start streaming execution
  - Auto-reconnect on disconnect
  - Resume from checkpoint
  - Handle user input requests

### Artifacts

- `listArtifacts(params)` - List session artifacts
- `getArtifact(artifactId)` - Get artifact
- `updateArtifact(artifactId, updates)` - Update artifact

### Memories

- `queryMemories(params)` - Query memories
- `writeMemory(params)` - Write memory
- `deleteMemory(memoryId)` - Delete memory

## License

MIT
