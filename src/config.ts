import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface Config {
  apiKey: string;
  port: number;
  dataDir: string;
  basePort: number;
  dockerImage: string;
  edgenodePassword: string;
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value || defaultValue!;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    return defaultValue;
  }
  return num;
}

export const config: Config = {
  apiKey: getEnv('API_KEY'),
  port: getEnvNumber('PORT', 3000),
  dataDir: getEnv('DATA_DIR', '/mnt/edgenodes'),
  basePort: getEnvNumber('BASE_PORT', 17888),
  dockerImage: getEnv('DOCKER_IMAGE', 'thetalabsorg/edgelauncher_mainnet:v1.0.0'),
  edgenodePassword: getEnv('EDGENODE_PASSWORD'),
};

export function getNodeDataDir(nodeName: string): string {
  return path.join(config.dataDir, nodeName);
}

export function getMetadataPath(): string {
  return path.join(config.dataDir, 'nodes.json');
}

