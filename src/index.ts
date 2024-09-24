import { BN, Idl } from "@project-serum/anchor";
import { Web3 } from 'web3';
import axios from 'axios';
import { PublicKey, Connection, Secp256k1Program } from "@solana/web3.js";
import { SolanaParser } from "@debridge-finance/solana-transaction-parser";
import dotenv from 'dotenv';
dotenv.config();
import { IDL as CCTPIdl, TokenMessengerMinter } from "./types/token_messenger_minter"; 
import { IDL as MTIdl, MessageTransmitter } from "./types/message_transmitter";
import { keccak256 } from "js-sha3";
const CCTP_PROGRAM_ID = "CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3";
const rpcConnection = new Connection(process.env.SOLANA_RPC_URL || "");
const txParser = new SolanaParser([{ idl: CCTPIdl as unknown as Idl, programId: new PublicKey(CCTP_PROGRAM_ID) }]);
const tx2Parser = new SolanaParser([{ idl: MTIdl as unknown as Idl, programId: new PublicKey(CCTP_PROGRAM_ID) }]);

type DepositForBurnArgs = {
    params: {
        amount: BN;
        destinationDomain: BN;
        mintRecipient: PublicKey;
    }
}
let alchemyApiKey = process.env.ALCHEMY_API_KEY || "";
const web3 = new Web3();
// Ethereum	0	0x0a992d191deec32afe36203ad87d7d289a738f81
// Avalanche	1	0x8186359af5f57fbb40c6b14a588d2a59c0c29880
// OP Mainnet	2	0x4d41f22c5a0e5c74090899e5a8fb597a8842b3e8
// Arbitrum	3	0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca
// Base	6	0xAD09780d193884d503182aD4588450C416D6F9D4
// Polygon PoS	7	0xF3be9355363857F3e001be68856A2f96b4C39Ba9
const evmConfiguration = [
    {
        chainId: 0,
        address: "0x0a992d191deec32afe36203ad87d7d289a738f81",
        rpcAddress: `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
        name: "Ethereum",
        blockTime: 12,
    },
    {
        chainId: 1,
        address: "0x8186359af5f57fbb40c6b14a588d2a59c0c29880",
        rpcAddress: `https://api.avax.network/ext/bc/C/rpc`,
        name: "Avalanche",
        blockTime: 2,
    },
    {
        chainId: 2,
        address: "0x4d41f22c5a0e5c74090899e5a8fb597a8842b3e8",
        rpcAddress: `https://opt-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
        name: "Optimism",
        blockTime: 2,
    },
    {
        chainId: 3,
        address: "0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca",
        rpcAddress: `https://arb-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
        name: "Arbitrum",
        blockTime: 0.25,
    },
    {
        chainId: 6,
        address: "0xAD09780d193884d503182aD4588450C416D6F9D4",
        rpcAddress: `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
        name: "Base",
        blockTime: 2,
    },
    {
        chainId: 7,
        address: "0xF3be9355363857F3e001be68856A2f96b4C39Ba9",
        rpcAddress: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
        name: "Polygon",
        blockTime: 2,
    }
]
function getConfig(chainId: number) {
    return evmConfiguration.find(config => config.chainId === chainId);
}
function getChainName(chainId: number) {
    let config = getConfig(chainId);
    return config?.name;
}
function isChainSupported(chainId: number) {
    return getConfig(chainId) !== undefined;
}
async function getL2Fee(chainId: number,txId: string) {
    let method = "eth_getTransactionReceipt";
    let params = [txId];
    let rpcInstanceCfg = getConfig(chainId);
    if (!rpcInstanceCfg) {
        console.error("Invalid chain ID");
        return;
    }
    let url = rpcInstanceCfg.rpcAddress;
    let axiosInstance = axios.create({
        baseURL: url,
        timeout: 10000,
        headers: {
            'Content-Type': 'application/json'
        }
    });
    let data = {
        jsonrpc: "2.0",
        method: method,
        params: params,
        id: 1
    }
    let response = await axiosInstance.post(url, data);
    let l1Fee = response.data.result.l1Fee;
    let l2GasUsed = response.data.result.gasUsed;
    let l2GasPrice = response.data.result.effectiveGasPrice;
    let l2Fee = l2GasUsed * l2GasPrice;
    l1Fee = parseInt(l1Fee);
    if (isNaN(l1Fee)) {
        l1Fee = 0;
    }
    let totalFee = l1Fee + l2Fee;
    totalFee = totalFee / 1e18;
    //console.log(`L1 Fee: ${l1Fee}, L2 Fee: ${l2Fee}, Total Fee: ${totalFee}`);
    return totalFee;
}

async function getTxByChainAndTxId(chainId: number, txId: string) {
    let rpcInstanceCfg = getConfig(chainId);
    if (!rpcInstanceCfg) {
        console.error("Invalid chain ID");
        return;
    }
    const web3Instance = new Web3(rpcInstanceCfg.rpcAddress);
    const tx = await web3Instance.eth.getTransactionReceipt(txId);
    return tx
  
}
function toNonExponential(num: number) {
    var m = num.toExponential().match(/\d(?:\.(\d*))?e([+-]?\d+)/);
    if (m) {
        return num.toFixed(Math.max(0, (m[1] || '').length - parseInt(m[2])));
    }
    return num.toString();
}
async function getTargetChainMintTx (targetAddress: string, targetChain: number, originalTimestamp: number, amount: number) {
    //let evmFilterTopic = "0xab8530f87dc9b59234c4623bf917212bb2536d647574c8e7e5da92c2ede0c9f8"
    let transferFilterTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    let ethereumStandardAddress =  web3.utils.toChecksumAddress(web3.utils.padLeft(targetAddress, 40, '0').toLowerCase());
    let rpcInstanceCfg = getConfig(targetChain);
    if (!rpcInstanceCfg) {
        console.error("Invalid chain ID");
        return;
    }
    const web3Instance = new Web3(rpcInstanceCfg.rpcAddress);
    let latestBlock = await web3Instance.eth.getBlockNumber();
    let latsetBlockNumber = latestBlock.toString() ;
    let padding = web3.utils.padLeft(ethereumStandardAddress, 64, '0').toLowerCase();
    let blockTime = rpcInstanceCfg.blockTime;
    let timeDiff = Date.now() / 1000 - originalTimestamp;
    //console.log("Time Diff: ", timeDiff);
    let blockDiff = Math.floor(timeDiff / blockTime);
    blockDiff =  Math.floor(blockDiff / 2);
    //console.log("Block Diff: ", blockDiff);
    var toBlock = parseInt(latestBlock.toString()); 
    toBlock = toBlock - blockDiff;

    
    // console.log("From Block: ", fromBlock);
    // console.log("To Block: ", toBlock);
    var tryCount = 0;
    var step = 10000;
    if (targetChain == 1) {
        step = 2000;
    }
    var fromBlock = toBlock - step;
    while (tryCount < 20) {
        const filter = {
            fromBlock: fromBlock,
            toBlock: toBlock,
        //  address: web3.utils.toChecksumAddress(rpcInstanceCfg.address),
            topics: [transferFilterTopic, "0x0000000000000000000000000000000000000000000000000000000000000000",padding],
            // data: "0x"+web3.utils.padLeft(amount.toString(16), 64, '0')
        };
        //console.log(filter);
        const logs = await web3Instance.eth.getPastLogs(filter);
        //console.log(logs);
        if (logs.length > 0) {
            for (let log of logs) {
                if (typeof log === 'object' && log !== null && 'data' in log && log.data === "0x"+web3.utils.padLeft(amount.toString(16), 64, '0')) {
                    let log = logs.find(log => typeof log === 'object' && log !== null && 'data' in log && log.data === "0x"+web3.utils.padLeft(amount.toString(16), 64, '0'));
                    if (typeof log === 'object' && log !== null && 'transactionHash' in log) {
                        let txHash = log.transactionHash as string;
                        //console.log(txHash);
                        let tx = await getTxByChainAndTxId(targetChain, txHash);
                        //console.log(tx);
                        if (!tx) {
                            console.log("No transaction found");
                            return;
                        }
            
                        let timestamp = await getBlkTimestamp(targetChain, tx.blockNumber);
                        //console.log(`Block Timestamp: ${timestamp}`);
                        let txFee = await getL2Fee(targetChain, txHash);
                        //console.log(`Transaction Fee: ${toNonExponential(txFee)}`);
                        if (timestamp !== undefined) {
                            let timeDiff = Number(timestamp) - originalTimestamp;
                            //console.log(`Time Difference: ${timeDiff} seconds`);
                            return [timestamp, txHash, timeDiff, txFee];
                        } else {
                            console.error("Timestamp is undefined");
                        }
                    
                    }
                }
            }
        } else {
            fromBlock = fromBlock - step;
            toBlock = toBlock - step;
            tryCount++;
        }
        // sleep 1 second
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.log("No transaction found for", targetAddress, targetChain, originalTimestamp, amount);
    return [0,0,0,0];
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
        // let parsed2 = await tx2Parser.parseTransaction(
        //     rpcConnection,
        //     txSignature
        //   );
        //   console.log(parsed2);
        let args = parsed[0].args as DepositForBurnArgs;
        let detail = await getTxFee(txSignature);
        let fee = detail[0];
        let timestamp = detail[1] as number;
        let domain = parseInt(args.params.destinationDomain.toString());
        
        if (isChainSupported(domain)) {
            let targetTx = await getTargetChainMintTx(publicKeyToEthereumAddress(args.params.mintRecipient), domain, timestamp, parseInt(args.params.amount.toString()));
            if (targetTx !== undefined) {
            // [timestamp, txHash, timeDiff, txFee]
            let afterTimestamp = targetTx[0];
            let txHash = targetTx[1];
            let timeDiff = targetTx[2];
            let txFee = targetTx[3];
            if (timeDiff < 0) {
                //console.log("Time Diff is negative");
                return;
            }
            console.log(txSignature, timestamp, parseInt(args.params.amount.toString())/1e6,getChainName(domain), 
            publicKeyToEthereumAddress(args.params.mintRecipient), 
            fee as number/1000000000, txHash, parseInt(afterTimestamp), timeDiff, toNonExponential(txFee));
            }
        }
    }
  }
}

async function getAllTransactions() {
    const txs = await rpcConnection.getSignaturesForAddress(new PublicKey(CCTP_PROGRAM_ID), {before:"PFN2CiffvQm23G6oaebx37re9CTbDaDdRVaxc6Fi8uy9ZKJoTqpmmGJrJRCqVUUc6qigKoDi2BgiCM33rx8aHoc", limit: 1000});
    //console.log("Length: ", txs.length);
    for (const tx of txs) {
  
        parseTx(tx.signature).catch((error) => {
            console.error(`Error parsing transaction ${tx.signature}:`, error);
        });
        
        // wait 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}


//parseTx("EDv2juvMEjKhqJavGB5VPzxqkR5d6UaVeRHknLXMthwaTLjuCxByPLVvzmbJC5u6ZKACbHtPjT3VUHUtce2zZUJ").catch(console.error);
//console.log(getTxFee("3Z4rGEUzpcDMaTzvDdkCX54noMmE7G1gDawKY4KU56eLnof2XBufsDJhXRWZsUUxmHpnNtZiRyWER44sT46mNcmu").catch(console.error));
getAllTransactions().catch(console.error);

//getTargetChainMintTx("0x56835a9495542d1eb6c0f8eba66d8aa56ce83d13", 3, 1727169616, 2586.32605*1e6).catch(console.error);

async function getBlkTimestamp(targetChain: number, blockNumber: bigint) {
    let rpcInstanceCfg = getConfig(targetChain);
    if (!rpcInstanceCfg) {
        console.error("Invalid chain ID");
        return;
    }
    const web3Instance = new Web3(rpcInstanceCfg.rpcAddress);
    let block = await web3Instance.eth.getBlock(blockNumber);
    return block.timestamp;
}
//getTxByChainAndTxId(6, "0x56835a9495542d1eb6c0f8eba66d8aa56ce83d13").catch(console.error);
//getL2Fee(0, "0x826108e3c3cc8c854754800dde12aeffc7f3b6859961b2d2f5435e81776eca01").catch(console.error);