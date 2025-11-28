/// <reference path="../types/thetajs.d.ts" />
import axios from 'axios';
import { config } from '../config';
import { readKeystore } from './keystore.service';
import * as thetajs from '@thetalabs/theta-js';
const { transactions } = thetajs;
const { StakeRewardDistributionTransaction } = transactions;

const MINIMUM_TFUEL_BALANCE = 0.3; // Minimum TFuel required (0.3 TFuel)

interface RPCResponse {
  jsonrpc: string;
  result?: string | any;
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

interface AccountResult {
  sequence?: string | number;
  coins?: {
    thetawei?: string;
    tfuelwei?: string;
  };
  [key: string]: any;
}

/**
 * Check TFuel balance for a given address
 */
export async function checkTFuelBalance(address: string): Promise<number> {
  try {
    const response = await axios.post<RPCResponse>(config.thetaRpcUrl, {
      jsonrpc: '2.0',
      method: 'theta.GetAccount',
      params: [{ address }],
      id: 1,
    });

    if (response.data.error) {
      throw new Error(`RPC error: ${response.data.error.message}`);
    }

    if (!response.data.result) {
      throw new Error('No account result from RPC');
    }

    const account = response.data.result as AccountResult;
    const tfuelwei = account.coins?.tfuelwei;

    if (!tfuelwei) {
      // Account might not exist or have no balance
      return 0;
    }

    // Convert from tfuelwei (string) to TFuel (number)
    // 1 TFuel = 10^18 wei
    const balanceWei = BigInt(tfuelwei);
    const balanceTFuel = Number(balanceWei) / 1e18;

    return balanceTFuel;
  } catch (error: any) {
    if (error.response?.data?.error) {
      throw new Error(`RPC error: ${error.response.data.error.message}`);
    }
    throw new Error(`Failed to check balance: ${error.message}`);
  }
}

/**
 * Get the next sequence number for a wallet address
 */
async function getSequence(address: string): Promise<number> {
  try {
    const response = await axios.post<RPCResponse>(config.thetaRpcUrl, {
      jsonrpc: '2.0',
      method: 'theta.GetAccount',
      params: [{ address }],
      id: 1,
    });

    if (response.data.error) {
      throw new Error(`RPC error: ${response.data.error.message}`);
    }

    if (!response.data.result) {
      return 1; // Default to 1 if account doesn't exist
    }

    const account = response.data.result as AccountResult;
    if (account.sequence) {
      const seq = typeof account.sequence === 'string' 
        ? parseInt(account.sequence, 10) 
        : account.sequence;
      return seq + 1;
    }
    return 1;
  } catch (error: any) {
    // If account doesn't exist or error, default to sequence 1
    return 1;
  }
}

/**
 * Execute StakeRewardDistributionTransaction for a node
 */
export async function executeStakeRewardDistribution(
  nodeName: string,
  rewardWallet: string,
  splitFee: number
): Promise<string> {
  // Validate splitFee
  if (splitFee < 0 || splitFee > 1000) {
    throw new Error('splitFee must be between 0 and 1000');
  }

  // Validate rewardWallet address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(rewardWallet)) {
    throw new Error('Invalid rewardWallet address format');
  }

  // Load keystore file
  const keystoreBuffer = await readKeystore(nodeName);

  // Decrypt keystore using password from config
  let wallet: thetajs.Wallet;
  try {
    wallet = await thetajs.Wallet.fromEncryptedJson(keystoreBuffer.toString("utf8"), config.password);
  } catch (error: any) {
    throw new Error(`Failed to decrypt keystore: ${error.message}`);
  }

  const nodeAddress = wallet.getAddress();
  const privateKey = wallet.privateKey;

  // Check TFuel balance
  const balance = await checkTFuelBalance(nodeAddress);
  if (balance < MINIMUM_TFUEL_BALANCE) {
    throw new Error(
      `Insufficient TFuel balance. Required: ${MINIMUM_TFUEL_BALANCE} TFuel, Current: ${balance.toFixed(6)} TFuel`
    );
  }

  // Get sequence number
  const sequence = await getSequence(nodeAddress);

  // Create transaction
  const tx = new StakeRewardDistributionTransaction({
    holder: nodeAddress,
    beneficiary: rewardWallet,
    splitBasisPoint: splitFee,
    sequence,
  });

  // Sign transaction
  const chainID = config.thetaChainId.toString();
  const signature = transactions.sign(chainID, tx, privateKey);

  // Serialize
  const rawBytes = transactions.serialize(tx, signature);
  const rawBytesHex = rawBytes.startsWith('0x') ? rawBytes : '0x' + rawBytes;

  // Broadcast (correct RPC)
  const response = await fetch(config.thetaRpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'theta.BroadcastRawTransaction',
      params: [rawBytesHex]   // <-- correct
    })
  });

  const result = await response.json() as RPCResponse;
  if (result.error) {
    throw new Error(result.error.message || 'RPC error');
  }
  
  return result.result;
}

