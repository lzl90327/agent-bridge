import { AgentBridgeConfig, StreamHandlers, StreamEvent } from './types';

interface StreamParams {
  sessionId: string;
  skillId: string;
  input: Record<string, any>;
  handlers: StreamHandlers;
}

export class StreamManager {
  private config: AgentBridgeConfig;
  private params: StreamParams;
  private ws: WebSocket | null = null;
  private messageId: string = '';
  private runId: string = '';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private lastCheckpointId?: string;
  private isConnecting: boolean = false;

  constructor(config: AgentBridgeConfig, params: StreamParams) {
    this.config = config;
    this.params = params;
  }

  connect(): void {
    if (this.isConnecting) return;
    this.isConnecting = true;

    const wsUrl = `${this.config.endpoint.replace('http', 'ws')}/api/v1/stream`;
    
    try {
      this.ws = new WebSocket(`${wsUrl}?token=${this.generateToken()}&session_id=${this.params.sessionId}`);
      
      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        if (this.runId && this.lastCheckpointId) {
          // 恢复模式
          this.sendResume();
        } else {
          // 新调用
          this.sendInvoke();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data: StreamEvent = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          this.params.handlers.onError?.(new Error('Failed to parse message'));
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.handleDisconnect();
      };

      this.ws.onerror = (error) => {
        this.isConnecting = false;
        this.params.handlers.onError?.(new Error('WebSocket error'));
      };
    } catch (error) {
      this.isConnecting = false;
      this.params.handlers.onError?.(error as Error);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  submitInput(input: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.send({
      type: 'input',
      id: this.generateMessageId(),
      payload: {
        run_id: this.runId,
        input
      }
    });
  }

  cancel(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.send({
      type: 'cancel',
      id: this.generateMessageId(),
      payload: { run_id: this.runId }
    });
  }

  private sendInvoke(): void {
    this.messageId = this.generateMessageId();
    this.send({
      type: 'invoke',
      id: this.messageId,
      payload: {
        skill_id: this.params.skillId,
        input: this.params.input
      }
    });
  }

  private sendResume(): void {
    this.messageId = this.generateMessageId();
    this.send({
      type: 'resume',
      id: this.messageId,
      payload: {
        run_id: this.runId,
        last_checkpoint: this.lastCheckpointId
      }
    });
  }

  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(event: StreamEvent): void {
    switch (event.type) {
      case 'run_started':
        this.runId = (event as any).run_id;
        break;
        
      case 'chunk':
        this.params.handlers.onChunk?.(event as any);
        break;
        
      case 'checkpoint':
        this.lastCheckpointId = (event as any).payload.checkpoint_id;
        this.params.handlers.onCheckpoint?.(event as any);
        break;
        
      case 'waiting_input':
        this.params.handlers.onWaitingInput?.(event as any);
        break;
        
      case 'completed':
        this.params.handlers.onCompleted?.(event as any);
        this.disconnect();
        break;
        
      case 'failed':
        this.params.handlers.onFailed?.(event as any);
        this.disconnect();
        break;
        
      case 'error':
        this.params.handlers.onError?.(new Error((event as any).payload.message));
        break;
    }
  }

  private handleDisconnect(): void {
    this.params.handlers.onDisconnected?.({ type: 'disconnected', reason: 'connection_closed' });
    
    // 尝试重连
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        60000
      );
      
      setTimeout(() => {
        this.params.handlers.onReconnected?.({ type: 'reconnected' });
        this.connect();
      }, delay);
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateToken(): string {
    // TODO: 实现 JWT token 生成
    return `${this.config.appKey}.${this.config.appSecret}`;
  }
}
