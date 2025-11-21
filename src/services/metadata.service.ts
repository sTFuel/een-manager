import fs from 'fs/promises';
import path from 'path';
import { NodeMetadata, NodesMetadata } from '../types';
import { getMetadataPath, config } from '../config';

const METADATA_FILE = getMetadataPath();

async function ensureDataDir(): Promise<void> {
  const dir = path.dirname(METADATA_FILE);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function readMetadata(): Promise<NodesMetadata> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(METADATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return default
      return {
        nodes: [],
        nextPort: config.basePort,
      };
    }
    throw error;
  }
}

async function writeMetadata(metadata: NodesMetadata): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
}

export async function getAllNodes(): Promise<NodeMetadata[]> {
  const metadata = await readMetadata();
  return metadata.nodes;
}

export async function getNode(name: string): Promise<NodeMetadata | null> {
  const nodes = await getAllNodes();
  return nodes.find(n => n.name === name) || null;
}

export async function createNode(name: string, keystorePath: string): Promise<NodeMetadata> {
  const metadata = await readMetadata();
  
  // Check if node already exists
  if (metadata.nodes.some(n => n.name === name)) {
    throw new Error(`Node ${name} already exists`);
  }

  // Assign next available port
  const port = metadata.nextPort;
  metadata.nextPort = port + 1;

  const node: NodeMetadata = {
    name,
    port,
    status: 'stopped',
    keystorePath,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  metadata.nodes.push(node);
  await writeMetadata(metadata);

  return node;
}

export async function updateNode(name: string, updates: Partial<NodeMetadata>): Promise<NodeMetadata> {
  const metadata = await readMetadata();
  const nodeIndex = metadata.nodes.findIndex(n => n.name === name);
  
  if (nodeIndex === -1) {
    throw new Error(`Node ${name} not found`);
  }

  metadata.nodes[nodeIndex] = {
    ...metadata.nodes[nodeIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeMetadata(metadata);
  return metadata.nodes[nodeIndex];
}

export async function deleteNode(name: string): Promise<void> {
  const metadata = await readMetadata();
  metadata.nodes = metadata.nodes.filter(n => n.name !== name);
  await writeMetadata(metadata);
}

export async function getNextPort(): Promise<number> {
  const metadata = await readMetadata();
  return metadata.nextPort;
}

