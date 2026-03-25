import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { Skill, Tool, Run } from '../types';

export interface OpenClawConfig {
  baseURL: string;
  apiKey?: string;
}

export interface InvokeSkillRequest {
  skill_ref: string;
  input: Record<string, any>;
  session_id: string;
  run_id: string;
}

export interface InvokeToolRequest {
  tool_ref: string;
  input: Record<string, any>;
  session_id: string;
  run_id: string;
}

export interface StreamChunk {
  type: 'chunk' | 'checkpoint' | 'complete' | 'error';
  content?: string;
  checkpoint_id?: string;
  error?: { code: string; message: string };
}

export class OpenClawAdapter {
  private client: AxiosInstance;
  private config: OpenClawConfig;

  constructor(config: OpenClawConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: 30000,
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}
    });
  }

  // 调用 delegated_skill - 使用 WebSocket 连接
  async invokeSkill(skill: Skill, request: InvokeSkillRequest): Promise<Record<string, any>> {
    if (skill.skill_type !== 'delegated_skill' || !skill.runtime_config) {
      throw new Error('Skill is not delegated to OpenClaw');
    }

    // OpenClaw 使用 WebSocket 进行技能调用
    return new Promise((resolve, reject) => {
      const wsUrl = this.config.baseURL.replace(/^http/, 'ws') + '/ws';
      const ws = new WebSocket(wsUrl, {
        headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}
      });

      const messages: any[] = [];
      let timeout: NodeJS.Timeout;

      ws.on('open', () => {
        // 发送调用请求
        ws.send(JSON.stringify({
          type: 'invoke',
          skill: skill.runtime_config!.skill_ref,
          input: request.input,
          session_id: request.session_id,
          run_id: request.run_id
        }));

        // 设置超时
        timeout = setTimeout(() => {
          ws.close();
          reject(new Error('OpenClaw invocation timeout'));
        }, 60000);
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          messages.push(message);

          if (message.type === 'complete' || message.type === 'error') {
            clearTimeout(timeout);
            ws.close();

            if (message.type === 'error') {
              reject(new Error(message.error?.message || 'OpenClaw invocation failed'));
            } else {
              resolve({ messages, result: message.result });
            }
          }
        } catch (e) {
          // 忽略非 JSON 消息
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        if (messages.length === 0) {
          reject(new Error('WebSocket closed without response'));
        }
      });
    });
  }

  // 调用 provider_tool - 使用 WebSocket 连接
  async invokeTool(tool: Tool, request: InvokeToolRequest): Promise<Record<string, any>> {
    if (tool.tool_type !== 'provider_tool' || !tool.provider_config) {
      throw new Error('Tool is not a provider tool');
    }

    return new Promise((resolve, reject) => {
      const wsUrl = this.config.baseURL.replace(/^http/, 'ws') + '/ws';
      const ws = new WebSocket(wsUrl, {
        headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}
      });

      let timeout: NodeJS.Timeout;

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'tool_invoke',
          tool: tool.provider_config!.tool_ref,
          input: request.input,
          session_id: request.session_id,
          run_id: request.run_id
        }));

        timeout = setTimeout(() => {
          ws.close();
          reject(new Error('OpenClaw tool invocation timeout'));
        }, 30000);
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'tool_complete' || message.type === 'error') {
            clearTimeout(timeout);
            ws.close();

            if (message.type === 'error') {
              reject(new Error(message.error?.message || 'Tool invocation failed'));
            } else {
              resolve(message.result);
            }
          }
        } catch (e) {
          // 忽略非 JSON 消息
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  // 流式调用 skill - 使用 WebSocket
  async *streamSkill(skill: Skill, request: InvokeSkillRequest): AsyncGenerator<StreamChunk> {
    if (skill.skill_type !== 'delegated_skill' || !skill.runtime_config) {
      throw new Error('Skill is not delegated to OpenClaw');
    }

    const wsUrl = this.config.baseURL.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(wsUrl, {
      headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}
    });

    const messageQueue: StreamChunk[] = [];
    let resolveNext: ((value: IteratorResult<StreamChunk>) => void) | null = null;
    let done = false;
    let error: Error | null = null;

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'stream',
        skill: skill.runtime_config!.skill_ref,
        input: request.input,
        session_id: request.session_id,
        run_id: request.run_id
      }));
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        const chunk: StreamChunk = {
          type: message.type,
          content: message.content,
          checkpoint_id: message.checkpoint_id,
          error: message.error
        };

        if (resolveNext) {
          resolveNext({ value: chunk, done: false });
          resolveNext = null;
        } else {
          messageQueue.push(chunk);
        }

        if (message.type === 'complete' || message.type === 'error') {
          done = true;
          ws.close();
        }
      } catch (e) {
        // 忽略非 JSON 消息
      }
    });

    ws.on('error', (err) => {
      error = err;
      done = true;
      if (resolveNext) {
        resolveNext({ value: undefined as any, done: true });
      }
    });

    ws.on('close', () => {
      done = true;
      if (resolveNext) {
        resolveNext({ value: undefined as any, done: true });
      }
    });

    try {
      while (!done || messageQueue.length > 0) {
        if (messageQueue.length > 0) {
          yield messageQueue.shift()!;
        } else if (!done) {
          const result = await new Promise<IteratorResult<StreamChunk>>((resolve) => {
            resolveNext = resolve;
          });
          if (result.done) break;
          yield result.value;
        } else {
          break;
        }
      }
    } finally {
      ws.close();
    }

    if (error) throw error;
  }

  // 健康检查 - 尝试 WebSocket 连接
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();
    try {
      const wsUrl = this.config.baseURL.replace(/^http/, 'ws') + '/ws';
      const ws = new WebSocket(wsUrl, {
        headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}
      });

      return await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve({ healthy: false, latency: Date.now() - start });
        }, 5000);

        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve({ healthy: true, latency: Date.now() - start });
        });

        ws.on('error', () => {
          clearTimeout(timeout);
          resolve({ healthy: false, latency: Date.now() - start });
        });
      });
    } catch (error) {
      return { healthy: false, latency: Date.now() - start };
    }
  }
}
