export {};
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined;
      SOLANA_RPC_URL: string;
      ALCHEMY_API_KEY: string;
    }
  }
}
