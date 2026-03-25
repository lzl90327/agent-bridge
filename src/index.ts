import express from 'express';
import { Pool } from 'pg';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { createRestAPI } from './api/rest';
import { createWebSocketServer } from './api/websocket';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// 数据库连接
const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 中间件
app.use(express.json());

// REST API
app.use('/api/v1', createRestAPI(db));

// WebSocket
createWebSocketServer(wss, db);

// 健康检查
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'healthy', checks: { database: 'ok' } });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', checks: { database: 'error' } });
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Agent Bridge server running on port ${PORT}`);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await db.end();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
