// SDK 工具函数

import { AgentBridgeError, TimeoutError } from './errors';

export interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableErrors: ['CONNECTION_ERROR', 'TIMEOUT', 'RATE_LIMIT']
};

// 指数退避重试
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const cfg = { ...defaultRetryConfig, ...config };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= cfg.maxAttempts!; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // 检查是否应该重试
      if (attempt === cfg.maxAttempts) {
        throw error;
      }

      if (error instanceof AgentBridgeError) {
        if (!cfg.retryableErrors?.includes(error.code)) {
          throw error;
        }

        // 如果是限流错误，使用 retryAfter
        if (error.code === 'RATE_LIMIT' && (error as any).retryAfter) {
          await delay((error as any).retryAfter! * 1000);
          continue;
        }
      }

      // 计算延迟时间 (指数退避 + 抖动)
      const delayMs = Math.min(
        cfg.initialDelay! * Math.pow(cfg.backoffMultiplier!, attempt - 1),
        cfg.maxDelay!
      );
      const jitter = Math.random() * 0.3 * delayMs; // 30% 抖动
      await delay(delayMs + jitter);
    }
  }

  throw lastError;
}

// 延迟函数
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 带超时的 Promise
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(message)), timeoutMs)
    )
  ]);
}

// 生成唯一 ID
export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

// 深度合并对象
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key] as any);
    } else {
      result[key] = source[key] as any;
    }
  }

  return result;
}

// 事件发射器 (简化版)
export class EventEmitter<T extends Record<string, any>> {
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  on<K extends keyof T>(event: K, handler: (data: T[K]) => void): void {
    if (!this.listeners.has(event as string)) {
      this.listeners.set(event as string, new Set());
    }
    this.listeners.get(event as string)!.add(handler);
  }

  off<K extends keyof T>(event: K, handler: (data: T[K]) => void): void {
    const handlers = this.listeners.get(event as string);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    const handlers = this.listeners.get(event as string);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${String(event)}:`, error);
        }
      });
    }
  }

  once<K extends keyof T>(event: K, handler: (data: T[K]) => void): void {
    const onceHandler = (data: T[K]) => {
      this.off(event, onceHandler);
      handler(data);
    };
    this.on(event, onceHandler);
  }
}

// 防抖函数
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// 节流函数
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}