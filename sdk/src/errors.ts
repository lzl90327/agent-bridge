// SDK 错误类

export class AgentBridgeError extends Error {
  public code: string;
  public statusCode?: number;
  public details?: any;

  constructor(message: string, code: string, statusCode?: number, details?: any) {
    super(message);
    this.name = 'AgentBridgeError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AgentBridgeError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AgentBridgeError {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` (${id})` : ''} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AgentBridgeError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class RateLimitError extends AgentBridgeError {
  public retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class ConnectionError extends AgentBridgeError {
  constructor(message: string = 'Connection failed') {
    super(message, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
  }
}

export class TimeoutError extends AgentBridgeError {
  constructor(message: string = 'Request timeout') {
    super(message, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

// 错误工厂函数
export function createErrorFromResponse(response: Response, data: any): AgentBridgeError {
  const message = data?.error?.message || response.statusText;
  const code = data?.error?.code || 'UNKNOWN_ERROR';

  switch (response.status) {
    case 400:
      return new ValidationError(message, data?.error?.details);
    case 401:
      return new UnauthorizedError(message);
    case 404:
      return new NotFoundError(message);
    case 429:
      return new RateLimitError(message, data?.retry_after);
    case 503:
      return new ConnectionError(message);
    default:
      return new AgentBridgeError(message, code, response.status, data);
  }
}