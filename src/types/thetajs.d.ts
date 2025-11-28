declare module '@thetalabs/theta-js' {
  export class Wallet {
    static fromEncryptedJson(keystore: any, password: string): Promise<Wallet>;
    static sign(message: string, privateKey: string): string;
    getAddress(): string;
    getPrivateKey(): string;
  }

  export namespace transactions {
    export class StakeRewardDistributionTransaction {
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
}

