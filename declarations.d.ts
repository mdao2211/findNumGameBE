// Khai báo cho @vercel/node
declare module '@vercel/node' {
    import { Request, Response } from 'express';
    export type VercelRequest = Request;
    export type VercelResponse = Response;
  }
  
  // Khai báo cho aws-serverless-express
  declare module 'aws-serverless-express';
  