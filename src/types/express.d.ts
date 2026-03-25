// Express 类型扩展
declare global {
  namespace Express {
    interface Request {
      validatedBody?: any;
    }
  }
}

export {};