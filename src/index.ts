import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/error';
import { requestLogger } from './utils/logger';
import { createWebSocketServer } from './api/websocket';

// 导入路由
import sessionsRouter from './routes/sessions';
import runsRouter from './routes/runs';
import artifactsRouter from './routes/artifacts';
import memoriesRouter from './routes/memories';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// 中间件
app.use(express.json());
app.use(requestLogger());

// REST API 路由
app.use('/api/v1/sessions', sessionsRouter);
app.use('/api/v1/runs', runsRouter);
app.use('/api/v1/artifacts', artifactsRouter);
app.use('/api/v1/memories', memoriesRouter);

// WebSocket
createWebSocketServer(wss);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// 根路由
app.get('/', (req, res) => {
  res.json({
    name: 'Agent Bridge',
    version: '0.1.0',
    description: 'Agent接入与运行平台',
    endpoints: {
      sessions: '/api/v1/sessions',
      runs: '/api/v1/runs',
      artifacts: '/api/v1/artifacts',
      memories: '/api/v1/memories',
      websocket: '/ws',
      health: '/health'
    }
  });
});

// 错误处理
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Agent Bridge server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});