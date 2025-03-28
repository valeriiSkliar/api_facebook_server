import { Request } from 'express';

export interface User {
  id: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: User;
}
