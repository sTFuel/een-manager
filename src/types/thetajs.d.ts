declare module '@thetalabs/theta-js' {
  export class Wallet {
    static fromV3Keystore(keystore: any, password: string): Wallet;
    static sign(message: string, privateKey: string): string;
    getAddress(): string;
    getPrivateKey(): string;
  }
}

declare module '@thetalabs/theta-js/lib/transaction/StakeRewardDistributionTransaction' {
  export default class StakeRewardDistributionTransaction {
    constructor(tx: {
      holder: string;
      beneficiary: string;
      splitBasisPoint: number;
      sequence?: number;
      gasPrice?: any;
    });
    signBytes(chainID: string): string;
    setSignature(signature: string): void;
    getType(): number;
    rlpInput(): any;
  }
}

