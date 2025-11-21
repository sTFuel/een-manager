import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    res.status(401).json({ error: 'Missing API key' });
    return;
  }

  if (apiKey !== config.apiKey) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  next();
}

