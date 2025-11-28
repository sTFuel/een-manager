import axios from 'axios';
import { config } from '../config';
import { readKeystore } from './keystore.service';
import { Wallet } from 'thetajs';
// @ts-ignore - thetajs may not have full TypeScript definitions
import StakeRewardDistributionTransaction from 'thetajs/lib/transaction/StakeRewardDistributionTransaction';
// @ts-ignore - eth-lib may not have full TypeScript definitions
import RLP from 'eth-lib/lib/rlp';
// @ts-ignore - eth-lib may not have full TypeScript definitions
import Bytes from 'eth-lib/lib/bytes';

const MINIMUM_TFUEL_BALANCE = 0.3; // Minimum TFuel required (0.3 TFuel)

interface RPCResponse {
  jsonrpc: string;
  result?: string;
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

/**
 * Check TFuel balance for a given address
 */
export async function checkTFuelBalance(address: string): Promise<number> {
  try {
    const response = await axios.post<RPCResponse>(config.thetaRpcUrl, {
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [address, 'latest'],
      id: 1,
    });

    if (response.data.error) {
      throw new Error(`RPC error: ${response.data.error.message}`);
    }

    if (!response.data.result) {
      throw new Error('No balance result from RPC');
    }

    // Convert from wei (hex string) to TFuel (number)
    const balanceWei = BigInt(response.data.result);
    const balanceTFuel = Number(balanceWei) / 1e18; // 1 TFuel = 10^18 wei

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

    const account = response.data.result;
    return account.sequence ? parseInt(account.sequence, 10) + 1 : 1;
  } catch (error: any) {
    // If account doesn't exist or error, default to sequence 1
    return 1;
  }
}

/**
 * Broadcast a signed transaction to the network
 */
async function broadcastTransaction(signedTx: string): Promise<string> {
  try {
    const response = await axios.post<RPCResponse>(config.thetaRpcUrl, {
      jsonrpc: '2.0',
      method: 'theta.BroadcastRawTransaction',
      params: [signedTx],
      id: 1,
    });

    if (response.data.error) {
      throw new Error(`RPC error: ${response.data.error.message}`);
    }

    if (!response.data.result) {
      throw new Error('No transaction hash from RPC');
    }

    return response.data.result;
  } catch (error: any) {
    if (error.response?.data?.error) {
      throw new Error(`RPC error: ${error.response.data.error.message}`);
    }
    throw new Error(`Failed to broadcast transaction: ${error.message}`);
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
  const keystoreJson = JSON.parse(keystoreBuffer.toString('utf-8'));

  // Decrypt keystore using password from config
  let wallet: Wallet;
  try {
    wallet = Wallet.fromV3Keystore(keystoreJson, config.password);
  } catch (error: any) {
    throw new Error(`Failed to decrypt keystore: ${error.message}`);
  }

  const nodeAddress = wallet.getAddress();
  const privateKey = wallet.getPrivateKey();

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
  const signBytes = tx.signBytes(chainID);
  const signature = Wallet.sign(signBytes, privateKey);
  tx.setSignature(signature);

  // Serialize the signed transaction for broadcasting
  // The transaction needs to be RLP encoded with chainID, txType, and signed tx data
  const encodedChainID = RLP.encode(Bytes.fromString(chainID));
  const encodedTxType = RLP.encode(Bytes.fromNumber(tx.getType()));
  // After setting signature, rlpInput() includes the signature
  const encodedTx = RLP.encode(tx.rlpInput());
  
  // Combine chainID, txType, and tx data (remove 0x prefix from encoded values)
  const rawTx = encodedChainID.slice(2) + encodedTxType.slice(2) + encodedTx.slice(2);
  const signedTx = '0x' + rawTx;

  // Broadcast transaction
  const txHash = await broadcastTransaction(signedTx);

  return txHash;
}

