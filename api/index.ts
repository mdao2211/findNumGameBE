import { VercelRequest, VercelResponse } from '@vercel/node';
import { createServer, proxy } from 'aws-serverless-express';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const expressApp = express();
let cachedServer: any;

async function bootstrapServer() {
  const logger = new Logger('Bootstrap');
  // Sử dụng ExpressAdapter để tích hợp NestJS với Express
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

  // Cấu hình CORS (có thể thay đổi theo yêu cầu)
  app.enableCors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  });

  // (Tùy chọn) Setup Swagger cho API nếu cần
  const config = new DocumentBuilder()
    .setTitle('Find Numbers Game API')
    .setDescription('The Find Numbers Game API Description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.init();
  logger.log('🚀 Application initialized');
  // Chuyển đổi ứng dụng Express thành server dùng cho serverless
  return createServer(expressApp);
}

export default async (req: VercelRequest, res: VercelResponse) => {
  if (!cachedServer) {
    cachedServer = await bootstrapServer();
  }
  return proxy(cachedServer, req, res, 'PROMISE').promise;
};
