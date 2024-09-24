import { BN, Idl } from "@project-serum/anchor";
import { PublicKey, Connection, Secp256k1Program } from "@solana/web3.js";
import { SolanaParser } from "@debridge-finance/solana-transaction-parser";
import { IDL as CCTPIdl, TokenMessengerMinter } from "./types/token_messenger_minter"; 
import { keccak256 } from "js-sha3";
const CCTP_PROGRAM_ID = "CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3";
const rpcConnection = new Connection("https://api.mainnet-beta.solana.com/");
const txParser = new SolanaParser([{ idl: CCTPIdl as unknown as Idl, programId: CCTP_PROGRAM_ID }]);

type DepositForBurnArgs = {
    params: {
        amount: BN;
        destinationDomain: BN;
        mintRecipient: PublicKey;
    }
}

function publicKeyToEthereumAddress(publicKey: PublicKey) {
    let hash = (publicKey as any)._bn as BN;
    return "0x"+hash.toString(16);
}

async function getTxFee(signature: string) {
    const tx = await rpcConnection.getTransaction(signature);
    if (tx) {
        //console.log(tx);
        let postBalance = tx.meta?.postBalances[0] as number;
        let preBalance = tx.meta?.preBalances[0] as number;
        let fee = preBalance - postBalance ;
        return [fee, tx.blockTime];
    }
    return [0, 0];
}

async function parseTx(txSignature: string) {
  const parsed = await txParser.parseTransaction(
    rpcConnection,
    txSignature
  );
  //console.log(parsed);
  // Use parsed result here
  if (parsed && parsed.length > 0) {
    if (parsed[0].name == 'depositForBurn' && parsed[0].args ) {
        let args = parsed[0].args as DepositForBurnArgs;
        let detail = await getTxFee(txSignature);
        let fee = detail[0];
        let timestamp = detail[1];
        console.log(args.params.amount.toString(), args.params.destinationDomain, publicKeyToEthereumAddress(args.params.mintRecipient), fee, timestamp);
    
    }
  }
}

async function getAllTransactions() {
    const txs = await rpcConnection.getSignaturesForAddress(new PublicKey(CCTP_PROGRAM_ID), {limit: 10});
    //console.log("Length: ", txs.length);
    for (const tx of txs) {
        parseTx(tx.signature);
        // wait 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}


//parseTx("3Z4rGEUzpcDMaTzvDdkCX54noMmE7G1gDawKY4KU56eLnof2XBufsDJhXRWZsUUxmHpnNtZiRyWER44sT46mNcmu").catch(console.error);
//console.log(getTxFee("3Z4rGEUzpcDMaTzvDdkCX54noMmE7G1gDawKY4KU56eLnof2XBufsDJhXRWZsUUxmHpnNtZiRyWER44sT46mNcmu").catch(console.error));
getAllTransactions().catch(console.error);
