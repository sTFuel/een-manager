import express, { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { apiKeyAuth } from './middleware/auth';
import nodesRouter from './routes/nodes';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Apply API key authentication to all routes except health
app.use(apiKeyAuth);

// Routes
app.use('/nodes', nodesRouter);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Elite Edge Node Manager running on port ${PORT}`);
  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Docker image: ${config.dockerImage}`);
});

