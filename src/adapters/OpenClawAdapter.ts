import axios, { AxiosInstance } from 'axios';
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

  // 调用 delegated_skill
  async invokeSkill(skill: Skill, request: InvokeSkillRequest): Promise<Record<string, any>> {
    if (skill.skill_type !== 'delegated_skill' || !skill.runtime_config) {
      throw new Error('Skill is not delegated to OpenClaw');
    }

    const response = await this.client.post('/invoke', {
      skill: skill.runtime_config.skill_ref,
      input: request.input,
      session_id: request.session_id,
      run_id: request.run_id
    });

    return response.data;
  }

  // 调用 provider_tool
  async invokeTool(tool: Tool, request: InvokeToolRequest): Promise<Record<string, any>> {
    if (tool.tool_type !== 'provider_tool' || !tool.provider_config) {
      throw new Error('Tool is not a provider tool');
    }

    const response = await this.client.post('/tools/invoke', {
      tool: tool.provider_config.tool_ref,
      input: request.input,
      session_id: request.session_id,
      run_id: request.run_id
    });

    return response.data;
  }

  // 流式调用 skill
  async *streamSkill(skill: Skill, request: InvokeSkillRequest): AsyncGenerator<StreamChunk> {
    if (skill.skill_type !== 'delegated_skill' || !skill.runtime_config) {
      throw new Error('Skill is not delegated to OpenClaw');
    }

    const response = await this.client.post('/stream', {
      skill: skill.runtime_config.skill_ref,
      input: request.input,
      session_id: request.session_id,
      run_id: request.run_id
    }, {
      responseType: 'stream'
    });

    // 处理流式响应
    const stream = response.data;
    let buffer = '';

    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            yield {
              type: data.type,
              content: data.content,
              checkpoint_id: data.checkpoint_id,
              error: data.error
            };
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  }

  // 健康检查
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();
    try {
      await this.client.get('/health', { timeout: 5000 });
      return { healthy: true, latency: Date.now() - start };
    } catch (error) {
      return { healthy: false, latency: Date.now() - start };
    }
  }
}
