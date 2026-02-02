import fs from 'fs/promises';
import path from 'path';
import { getNodeDataDir, getKeystoreRelativePath } from '../config';

export function getKeystorePath(nodeName: string): string {
  const nodeDataDir = getNodeDataDir(nodeName);
  const keystoreRelativePath = getKeystoreRelativePath();
  return path.join(nodeDataDir, keystoreRelativePath);
}

export async function readKeystore(nodeName: string): Promise<Buffer> {
  const keystoreDir = getKeystorePath(nodeName);
  
  try {
    // The keystore file is inside the encrypted directory, named with the wallet address
    // List files in the directory and filter for keystore files (40-char hex strings, no extension)
    const files = await fs.readdir(keystoreDir);
    
    // Filter out hidden files and directories, look for 40-character hex strings (wallet addresses)
    const keystoreFiles = files.filter(file => {
      // Wallet address is 40 hex characters (lowercase, no 0x prefix)
      return /^[a-f0-9]{40}$/.test(file) && !file.startsWith('.');
    });
    
    if (keystoreFiles.length === 0) {
      throw new Error(
        `Keystore not found for node ${nodeName}. ` +
        `Expected keystore file in: ${keystoreDir}. ` +
        `Found files: ${files.length > 0 ? files.join(', ') : 'none'}`
      );
    }
    
    if (keystoreFiles.length > 1) {
      // Multiple keystore files found, use the first one but warn
      console.warn(
        `Multiple keystore files found for node ${nodeName}, using: ${keystoreFiles[0]}`
      );
    }
    
    // The keystore file is the wallet address (lowercase, no 0x prefix)
    const keystoreFile = keystoreFiles[0];
    const keystoreFilePath = path.join(keystoreDir, keystoreFile);
    
    return await fs.readFile(keystoreFilePath);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `Keystore directory not found for node ${nodeName}: ${keystoreDir}`
      );
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
    // Check for actual keystore files (40-char hex strings)
    const keystoreFiles = files.filter(file => {
      return /^[a-f0-9]{40}$/.test(file) && !file.startsWith('.');
    });
    return keystoreFiles.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the wallet address from the keystore file for a node
 * This reads the keystore file and extracts the address from the filename or JSON content
 */
export async function getKeystoreAddress(nodeName: string): Promise<string> {
  const keystoreDir = getKeystorePath(nodeName);
  
  try {
    const files = await fs.readdir(keystoreDir);
    const keystoreFiles = files.filter(file => {
      return /^[a-f0-9]{40}$/.test(file) && !file.startsWith('.');
    });
    
    if (keystoreFiles.length === 0) {
      throw new Error(`Keystore not found for node ${nodeName}`);
    }
    
    // The filename is the address (lowercase, no 0x prefix)
    const address = keystoreFiles[0];
    
    // Verify by reading the keystore and checking the address field
    try {
      const keystoreFilePath = path.join(keystoreDir, address);
      const keystoreData = await fs.readFile(keystoreFilePath, 'utf-8');
      const keystoreJson = JSON.parse(keystoreData);
      
      // Verify the address in the JSON matches the filename
      const jsonAddress = keystoreJson.address?.toLowerCase().replace('0x', '') || '';
      if (jsonAddress && jsonAddress !== address) {
        console.warn(
          `Address mismatch for node ${nodeName}: filename=${address}, json=${jsonAddress}`
        );
      }
    } catch (error) {
      // If we can't parse the JSON, that's okay - we'll use the filename
      console.warn(`Could not verify address from keystore JSON for node ${nodeName}`);
    }
    
    // Return with 0x prefix for consistency
    return `0x${address}`;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Keystore directory not found for node ${nodeName}: ${keystoreDir}`);
    }
    throw new Error(`Failed to get keystore address: ${error.message}`);
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

