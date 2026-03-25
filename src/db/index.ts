// 数据库连接工厂
import { memoryDB } from './memory-db';

export type DBClient = typeof memoryDB;

export function getDB(): DBClient {
  const dbUrl = process.env.DATABASE_URL || 'memory';

  if (dbUrl === 'memory') {
    console.log('[DB] Using in-memory database for development');
    return memoryDB;
  }

  // PostgreSQL 模式 - 返回内存数据库作为 fallback
  // 实际生产环境应该返回 PostgreSQL 客户端
  console.log('[DB] PostgreSQL not available, falling back to in-memory database');
  return memoryDB;
}

// 导出内存数据库供直接使用
export { memoryDB };