"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const web3_js_1 = require("@solana/web3.js");
const solana_transaction_parser_1 = require("@debridge-finance/solana-transaction-parser");
const token_messenger_minter_1 = require("./types/token_messenger_minter");
const CCTP_PROGRAM_ID = "CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3";
const rpcConnection = new web3_js_1.Connection("https://api.mainnet-beta.solana.com/");
const txParser = new solana_transaction_parser_1.SolanaParser([{ idl: token_messenger_minter_1.IDL, programId: CCTP_PROGRAM_ID }]);
function publicKeyToEthereumAddress(publicKey) {
    let hash = publicKey._bn;
    return "0x" + hash.toString(16);
}
function getTxFee(signature) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const tx = yield rpcConnection.getTransaction(signature);
        if (tx) {
            console.log(tx);
            let postBalance = (_a = tx.meta) === null || _a === void 0 ? void 0 : _a.postBalances[0];
            let preBalance = (_b = tx.meta) === null || _b === void 0 ? void 0 : _b.preBalances[0];
            let fee = preBalance - postBalance;
            return [fee, tx.blockTime];
        }
        return [0, 0];
    });
}
function parseTx(txSignature) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const parsed = yield txParser.parseTransaction(rpcConnection, txSignature);
        console.log(parsed);
        // Use parsed result here
        if (parsed && parsed.length > 0) {
            if (parsed[0].name == 'depositForBurn' && parsed[0].args) {
                let args = parsed[0].args;
                let detail = yield getTxFee(txSignature);
                let fee = detail[0];
                let timestamp = detail[1];
                console.log(args.params.amount.toString(), args.params.destinationDomain, publicKeyToEthereumAddress(args.params.mintRecipient), fee, timestamp);
            }
        }
    });
}
function getAllTransactions() {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const txs = yield rpcConnection.getSignaturesForAddress(new web3_js_1.PublicKey(CCTP_PROGRAM_ID), { limit: 10 });
        //console.log("Length: ", txs.length);
        for (const tx of txs) {
            parseTx(tx.signature);
            // wait 1 second
            yield new Promise(resolve => setTimeout(resolve, 1000));
        }
    });
}
//parseTx("3Z4rGEUzpcDMaTzvDdkCX54noMmE7G1gDawKY4KU56eLnof2XBufsDJhXRWZsUUxmHpnNtZiRyWER44sT46mNcmu").catch(console.error);
//console.log(getTxFee("3Z4rGEUzpcDMaTzvDdkCX54noMmE7G1gDawKY4KU56eLnof2XBufsDJhXRWZsUUxmHpnNtZiRyWER44sT46mNcmu").catch(console.error));
getAllTransactions().catch(console.error);
//# sourceMappingURL=index.js.map