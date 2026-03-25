import { WebSocketServer, WebSocket } from 'ws';
import { Pool } from 'pg';
import { RunManager } from '../services/RunManager';
import { WSClientMessage, WSServerMessage, Run } from '../types';

interface ClientInfo {
  ws: WebSocket;
  sessionId?: string;
  runId?: string;
}

export function createWebSocketServer(wss: WebSocketServer, db: Pool) {
  const clients = new Map<string, ClientInfo>();
  const runManager = new RunManager(db);

  wss.on('connection', (ws: WebSocket) => {
    const clientId = generateClientId();
    clients.set(clientId, { ws });

    console.log(`Client connected: ${clientId}`);

    ws.on('message', async (data: Buffer) => {
      try {
        const message: WSClientMessage = JSON.parse(data.toString());
        await handleMessage(clientId, message, clients, runManager, db);
      } catch (error) {
        console.error('WebSocket message error:', error);
        sendError(ws, message?.id || 'unknown', 'Invalid message format');
      }
    });

    ws.on('close', () => {
      console.log(`Client disconnected: ${clientId}`);
      clients.delete(clientId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
    });
  });
}

async function handleMessage(
  clientId: string,
  message: WSClientMessage,
  clients: Map<string, ClientInfo>,
  runManager: RunManager,
  db: Pool
) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case 'invoke':
      await handleInvoke(client, message, runManager);
      break;
    case 'resume':
      await handleResume(client, message, runManager);
      break;
    case 'input':
      await handleInput(client, message, runManager);
      break;
    case 'cancel':
      await handleCancel(client, message, runManager);
      break;
    case 'ping':
      handlePing(client, message);
      break;
    default:
      sendError(client.ws, message.id, 'Unknown message type');
  }
}

async function handleInvoke(
  client: ClientInfo,
  message: WSClientMessage,
  runManager: RunManager
) {
  const { session_id, skill_id, input } = message.payload;
  
  try {
    // 创建 run
    const run = await runManager.createRun({
      session_id,
      skill_id,
      skill_type: 'delegated_skill', // TODO: 根据 skill 配置确定
      input
    });

    client.sessionId = session_id;
    client.runId = run.id;

    // 发送 run_started 事件
    sendMessage(client.ws, {
      type: 'run_started',
      id: message.id,
      run_id: run.id,
      payload: { skill_id, status: 'running' }
    });

    // TODO: 启动 skill 执行，流式返回结果
    // 这里需要集成 SkillOrchestrator

  } catch (error) {
    sendError(client.ws, message.id, 'Failed to invoke skill');
  }
}

async function handleResume(
  client: ClientInfo,
  message: WSClientMessage,
  runManager: RunManager
) {
  const { run_id, from_sequence, last_checkpoint } = message.payload;

  try {
    const run = await runManager.getRun(run_id);
    if (!run) {
      return sendError(client.ws, message.id, 'Run not found');
    }

    // 检查是否可以恢复
    if (!['running', 'waiting_user_input', 'paused'].includes(run.status)) {
      return sendError(client.ws, message.id, `Cannot resume run in ${run.status} status`);
    }

    client.runId = run_id;
    client.sessionId = run.session_id;

    // 获取最新 snapshot
    const snapshot = await runManager.getLatestSnapshot(run_id);
    const resumeFromSequence = snapshot?.sequence || from_sequence || 0;

    // 发送恢复确认
    sendMessage(client.ws, {
      type: 'resumed',
      id: message.id,
      run_id: run_id,
      payload: {
        from_sequence: resumeFromSequence,
        current_status: run.status
      }
    });

    // 获取并发送丢失的事件
    const events = await runManager.getEventsAfter(run_id, resumeFromSequence);
    for (const event of events) {
      sendMessage(client.ws, {
        type: event.event_type,
        id: message.id,
        run_id: run_id,
        payload: event.payload
      });
    }

    // TODO: 重新订阅实时流

  } catch (error) {
    sendError(client.ws, message.id, 'Failed to resume run');
  }
}

async function handleInput(
  client: ClientInfo,
  message: WSClientMessage,
  runManager: RunManager
) {
  const { run_id, input } = message.payload;

  try {
    const run = await runManager.getRun(run_id);
    if (!run) {
      return sendError(client.ws, message.id, 'Run not found');
    }

    if (run.status !== 'waiting_user_input') {
      return sendError(client.ws, message.id, 'Run is not waiting for input');
    }

    // 记录用户输入事件
    await runManager.logEvent(
      run_id,
      run.session_id,
      'run.user_input_received',
      { input },
      'user'
    );

    // 更新状态
    await runManager.updateStatus(run_id, 'running', {
      waiting_input: null
    });

    // 发送确认
    sendMessage(client.ws, {
      type: 'input_received',
      id: message.id,
      run_id: run_id,
      payload: { status: 'running' }
    });

    // TODO: 通知执行引擎继续

  } catch (error) {
    sendError(client.ws, message.id, 'Failed to submit input');
  }
}

async function handleCancel(
  client: ClientInfo,
  message: WSClientMessage,
  runManager: RunManager
) {
  const { run_id } = message.payload;

  try {
    const run = await runManager.getRun(run_id);
    if (!run) {
      return sendError(client.ws, message.id, 'Run not found');
    }

    if (!runManager.canTransition(run.status, 'cancelled')) {
      return sendError(client.ws, message.id, `Cannot cancel run in ${run.status} status`);
    }

    await runManager.updateStatus(run_id, 'cancelled');

    sendMessage(client.ws, {
      type: 'run_cancelled',
      id: message.id,
      run_id: run_id,
      payload: { status: 'cancelled' }
    });

  } catch (error) {
    sendError(client.ws, message.id, 'Failed to cancel run');
  }
}

function handlePing(client: ClientInfo, message: WSClientMessage) {
  sendMessage(client.ws, {
    type: 'pong',
    id: message.id,
    payload: { timestamp: Date.now() }
  });
}

function sendMessage(ws: WebSocket, message: WSServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, id: string, errorMessage: string) {
  sendMessage(ws, {
    type: 'error',
    id,
    payload: { code: 'ERROR', message: errorMessage }
  });
}

function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
