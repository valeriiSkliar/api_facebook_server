import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

interface RequestWithUser extends Request {
  user: { id: string };
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: RequestWithUser, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-api-key'];
    const userKey = req.headers['x-user-key'];
    if (!apiKey || apiKey !== this.configService.get<string>('API_KEY')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!userKey || Array.isArray(userKey)) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    console.log('User key is valid');
    // Add user information to request based on API key or JWT
    req.user = { id: userKey };

    next();
  }
}
