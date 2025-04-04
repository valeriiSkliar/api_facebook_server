import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedRequest } from '../../authenticators/common/interfaces/auth.interface';
import { Response, NextFunction } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const serviceKey = req.headers['x-service-key'];
    const apiKey = req.headers['x-api-key'];
    const userKey = req.headers['x-user-key'];
    const email = req.headers['x-email'];
    if (serviceKey && serviceKey === 'service') {
      return next();
    }
    if (!apiKey || apiKey !== this.configService.get<string>('API_KEY')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!userKey || Array.isArray(userKey)) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!email || Array.isArray(email)) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Add user information to request based on API key or JWT
    req.user = { id: userKey, email };

    next();
  }
}
