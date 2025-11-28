import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export type Network = 'mainnet' | 'testnet';

export interface Config {
  apiKey: string;
  port: number;
  dataDir: string;
  basePort: number;
  dockerImage: string;
  password: string;
  network: Network;
  thetaRpcUrl: string;
  thetaChainId: number;
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

function getNetwork(): Network {
  const network = getEnv('NETWORK', 'mainnet').toLowerCase();
  if (network !== 'mainnet' && network !== 'testnet') {
    throw new Error(`Invalid NETWORK value: ${network}. Must be 'mainnet' or 'testnet'`);
  }
  return network as Network;
}

function getDockerImage(network: Network): string {
  // If DOCKER_IMAGE is explicitly set, use it
  const customImage = process.env.DOCKER_IMAGE;
  if (customImage) {
    return customImage;
  }
  
  // Otherwise, use default based on network
  return network === 'testnet' 
    ? 'pizajolo/edgecore-testnet:latest'
    : 'thetalabsorg/edgelauncher_mainnet:v1.0.0';
}

function getThetaRpcUrl(network: Network): string {
  // If THETA_RPC_URL is explicitly set, use it
  const customRpcUrl = process.env.THETA_RPC_URL;
  if (customRpcUrl) {
    return customRpcUrl;
  }
  
  // Otherwise, use default based on network
  return network === 'testnet'
    ? 'https://theta-bridge-rpc-testnet.thetatoken.org/rpc'
    : 'https://theta-bridge-rpc.thetatoken.org/rpc';
}

function getThetaChainId(network: Network): number {
  // If THETA_CHAIN_ID is explicitly set, use it
  const customChainId = process.env.THETA_CHAIN_ID;
  if (customChainId) {
    const chainId = parseInt(customChainId, 10);
    if (!isNaN(chainId)) {
      return chainId;
    }
  }
  
  // Otherwise, use default based on network
  return network === 'testnet' ? 365 : 361;
}

const network = getNetwork();

export const config: Config = {
  apiKey: getEnv('API_KEY'),
  port: getEnvNumber('PORT', 3000),
  dataDir: getEnv('DATA_DIR', '/mnt/edgenodes'),
  basePort: getEnvNumber('BASE_PORT', 17888),
  password: getEnv('PASSWORD'),
  network,
  dockerImage: getDockerImage(network),
  thetaRpcUrl: getThetaRpcUrl(network),
  thetaChainId: getThetaChainId(network),
};

export function getNodeDataDir(nodeName: string): string {
  return path.join(config.dataDir, nodeName);
}

export function getMetadataPath(): string {
  return path.join(config.dataDir, 'nodes.json');
}

export function getKeystoreRelativePath(): string {
  return config.network === 'testnet'
    ? 'key/encrypted'
    : 'edgecore/key/encrypted';
}

