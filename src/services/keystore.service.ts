import fs from 'fs/promises';
import path from 'path';
import { getNodeDataDir } from '../config';

const KEYSTORE_RELATIVE_PATH = 'edgecore/key/encrypted';

export function getKeystorePath(nodeName: string): string {
  const nodeDataDir = getNodeDataDir(nodeName);
  return path.join(nodeDataDir, KEYSTORE_RELATIVE_PATH);
}

export async function readKeystore(nodeName: string): Promise<Buffer> {
  const keystorePath = getKeystorePath(nodeName);
  
  try {
    return await fs.readFile(keystorePath);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Keystore not found for node ${nodeName}`);
    }
    throw new Error(`Failed to read keystore: ${error.message}`);
  }
}

export async function writeKeystore(nodeName: string, keystoreData: Buffer | string): Promise<void> {
  const keystorePath = getKeystorePath(nodeName);
  const nodeDataDir = getNodeDataDir(nodeName);
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(keystorePath), { recursive: true });

  // Write keystore file
  if (Buffer.isBuffer(keystoreData)) {
    await fs.writeFile(keystorePath, keystoreData);
  } else {
    await fs.writeFile(keystorePath, keystoreData, 'utf-8');
  }
}

export async function writeKeystoreFromJSON(nodeName: string, keystoreData: object): Promise<void> {
  try {
    const jsonString = JSON.stringify(keystoreData, null, 2);
    await writeKeystore(nodeName, jsonString);
  } catch (error: any) {
    throw new Error(`Failed to write JSON keystore: ${error.message}`);
  }
}

export async function keystoreExists(nodeName: string): Promise<boolean> {
  const keystorePath = getKeystorePath(nodeName);
  try {
    await fs.access(keystorePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureNodeDataDir(nodeName: string): Promise<void> {
  const nodeDataDir = getNodeDataDir(nodeName);
  await fs.mkdir(nodeDataDir, { recursive: true });
}

