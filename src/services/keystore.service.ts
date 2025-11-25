import fs from 'fs/promises';
import path from 'path';
import { getNodeDataDir, getKeystoreRelativePath } from '../config';

const KEYSTORE_RELATIVE_PATH = getKeystoreRelativePath();

export function getKeystorePath(nodeName: string): string {
  const nodeDataDir = getNodeDataDir(nodeName);
  return path.join(nodeDataDir, KEYSTORE_RELATIVE_PATH);
}

export async function readKeystore(nodeName: string): Promise<Buffer> {
  const keystoreDir = getKeystorePath(nodeName);
  
  try {
    // The keystore file is inside the encrypted directory, named with the wallet address
    // List files in the directory and read the first file (should be the only one)
    const files = await fs.readdir(keystoreDir);
    
    if (files.length === 0) {
      throw new Error(`Keystore not found for node ${nodeName}`);
    }
    
    // The keystore file is the wallet address (lowercase, no 0x prefix)
    const keystoreFile = files[0];
    const keystoreFilePath = path.join(keystoreDir, keystoreFile);
    
    return await fs.readFile(keystoreFilePath);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Keystore not found for node ${nodeName}`);
    }
    throw new Error(`Failed to read keystore: ${error.message}`);
  }
}

export async function writeKeystore(nodeName: string, keystoreData: Buffer | string): Promise<void> {
  const keystoreDir = getKeystorePath(nodeName);
  const nodeDataDir = getNodeDataDir(nodeName);
  
  // Ensure directory exists
  await fs.mkdir(keystoreDir, { recursive: true });

  // Extract wallet address from keystore JSON to determine filename
  let walletAddress: string;
  if (typeof keystoreData === 'string') {
    try {
      const keystoreJson = JSON.parse(keystoreData);
      walletAddress = keystoreJson.address?.toLowerCase().replace('0x', '') || '';
      if (!walletAddress) {
        throw new Error('Keystore JSON does not contain an address field');
      }
    } catch (error: any) {
      throw new Error(`Failed to parse keystore JSON to extract address: ${error.message}`);
    }
  } else {
    // If it's a buffer, try to parse it as JSON
    try {
      const keystoreJson = JSON.parse(keystoreData.toString('utf-8'));
      walletAddress = keystoreJson.address?.toLowerCase().replace('0x', '') || '';
      if (!walletAddress) {
        throw new Error('Keystore JSON does not contain an address field');
      }
    } catch (error: any) {
      throw new Error(`Failed to parse keystore to extract address: ${error.message}`);
    }
  }

  // Write keystore file with wallet address as filename
  const keystoreFilePath = path.join(keystoreDir, walletAddress);
  if (Buffer.isBuffer(keystoreData)) {
    await fs.writeFile(keystoreFilePath, keystoreData);
  } else {
    await fs.writeFile(keystoreFilePath, keystoreData, 'utf-8');
  }
}

export async function writeKeystoreFromJSON(nodeName: string, keystoreData: object): Promise<void> {
  try {
    // Convert object to JSON string, then write it
    // writeKeystore will extract the wallet address from the JSON and use it as the filename
    // (wallet address in lowercase, without 0x prefix)
    const jsonString = JSON.stringify(keystoreData, null, 2);
    await writeKeystore(nodeName, jsonString);
  } catch (error: any) {
    throw new Error(`Failed to write JSON keystore: ${error.message}`);
  }
}

export async function keystoreExists(nodeName: string): Promise<boolean> {
  const keystoreDir = getKeystorePath(nodeName);
  try {
    const files = await fs.readdir(keystoreDir);
    return files.length > 0;
  } catch {
    return false;
  }
}

export async function ensureNodeDataDir(nodeName: string): Promise<void> {
  const nodeDataDir = getNodeDataDir(nodeName);
  const keystoreDir = getKeystorePath(nodeName);
  
  // Ensure both the node data directory and keystore directory structure exist
  // This is important so the container can write the keystore when it starts
  await fs.mkdir(nodeDataDir, { recursive: true });
  await fs.mkdir(keystoreDir, { recursive: true });
}

