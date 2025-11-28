declare module '@thetalabs/theta-js' {
  export class Wallet {
    static fromEncryptedJson(keystore: any, password: string): Promise<Wallet>;
    static sign(message: string, privateKey: string): string;
    getAddress(): string;
    privateKey: string;
  }

  export namespace transactions {
    export function sign(chainID: string, tx: any, privateKey: string): string;
    export function serialize(tx: any, signature: string): string;
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

