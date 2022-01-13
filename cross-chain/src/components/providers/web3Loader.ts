import { useEffect, useState, useRef, useCallback } from 'react';
import constate from 'constate';
import Web3 from "web3";
import Web3Modal, { CONNECT_EVENT } from "web3modal";

import { Sm1GiverOriginator } from '../../generatedTypes/web3-v1-contracts/Sm1GiverOriginator';
import sm1Json from '../../generatedTypes/Sm1GiverOriginator.json';

import { Sm2GiverEscrow } from '../../generatedTypes/web3-v1-contracts/Sm2GiverEscrow';
import sm2Json from '../../generatedTypes/Sm2GiverEscrow.json';

import { TestGTC } from '../../generatedTypes/web3-v1-contracts/TestGTC';
//import erc20Json from './erc20.json';
import erc20Json from '../../generatedTypes/TestGTC.json';
import { LoanRecordStatus } from '../svrProtocol';

//NOT sure whey there need to be require and cannot be imported
const ethUtil = require('ethereumjs-util');
const sigUtil = require('eth-sig-util')

export const RUPTEN_RPC = "https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161";



const providerOptions = {
    /* See Provider Options Section */
};

export const EVM_NETWORK_ADDRESS = "http://localhost:8545";

/*localhost
export const BSC_CONTRACTS = {
    sm1Orginator:'0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
    sm2Escrow: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
}
*/

export const BSC_CONTRACTS = {
    sm1Orginator: '0xa5Fd5d1Ce5E10fd9892d51E4e971c5855E2Ff973',
    sm2Escrow: '0x361cf804bF937638d9C9d24F22B1E7BFC3650Bf7',
}


///Plain text secret t be sent over wire
export function evmPackedSecret(secret: string) {
    return Web3.utils.sha3(secret) || '';
}

//The has wichc will be revelaed later
export function evmSecrethash(web3: Web3, secret: string) {

    const preImage = evmPackedSecret(secret);
    const encoded = web3.eth.abi.encodeParameters(['bytes32'], [preImage]);
    return web3.utils.keccak256(encoded)

}


export async function aprroveFunds(web3: Web3, bscAssetContract: string, erc20Instance: TestGTC,
    amount: number, owner: string, spender: string) {

    const depositAmt = web3.utils.toBN(web3.utils.toWei((amount).toString(), 'ether'));
    let approvalAmount = depositAmt;

    const allowance = await erc20Instance.methods.allowance(owner, spender).call();

    if (allowance) {
        const weiAllowance = web3.utils.toBN(allowance);

        if (weiAllowance.gte(approvalAmount)) {
            console.log('no approval needed');
            approvalAmount = web3.utils.toBN(0);
        } else {
            approvalAmount = approvalAmount.sub(weiAllowance);
        }

    }

    if (approvalAmount.gt(web3.utils.toBN(0))) {
        const apDone = erc20Instance.methods.approve(
            spender,
            approvalAmount
        );
        const apR = await apDone.send({ from: owner, to: bscAssetContract });
    }

    return depositAmt;
}





export const [
    EvmAppProvider,
    useConnect,
] = constate(
    useEvmDApp,
    (v) => v.connect
);


function useEvmDApp() {


    const web3Modal = new Web3Modal({
        //network: "mainnet", // optional
        network: EVM_NETWORK_ADDRESS,
        cacheProvider: true, // optional
        providerOptions // required
    });

    web3Modal.on(CONNECT_EVENT, async p => {

        //const web3 = new Web3(p);
    });

    const connect = useCallback(

        async () => {
            try {

                const provider = await web3Modal.connect();

                const web3 = new Web3(provider);

                const encrypter = async (webAccount: string, data: string) => {
                    try {
                        const encryptionPublicKey = await provider.request({
                            method: "eth_getEncryptionPublicKey",
                            params: [webAccount]
                        });


                        const k = sigUtil.encrypt(
                            encryptionPublicKey,
                            { data: 'hello uuuu' },
                            'x25519-xsalsa20-poly1305'
                        );


                        const encryptedMessage: string = ethUtil.bufferToHex(
                            Buffer.from(
                                JSON.stringify(k),
                                'utf8'
                            )
                        );

                        return encryptedMessage;

                    } catch (err: any) {
                        throw new Error(`You provide doesn't support encryption. please try metamask: ${err}`);
                    }
                }

                const decrypter = async (webAccount: string, encryptedMessage: string) => {
                    try {

                        const dectpted: string = await provider.request({
                            method: "eth_decrypt",
                            params: [encryptedMessage, webAccount]
                        });

                        return dectpted;

                    } catch (err: any) {
                        throw new Error(`You provide doesn't support encryption. please try metamask: ${err}`);
                    }
                }

                const smOriginator = (): Sm1GiverOriginator => new web3.eth.Contract(sm1Json.abi as any, BSC_CONTRACTS.sm1Orginator) as any;

                const smEscrow = (): Sm2GiverEscrow => new web3.eth.Contract(sm2Json.abi as any, BSC_CONTRACTS.sm2Escrow) as any;

                const erc20 = (address: string): TestGTC => new web3.eth.Contract(erc20Json.abi as any, address) as any;

                const originatorStatus = async (contratcId:string) => {
                    const evmLoan = await  smOriginator().methods.getContract(contratcId).call();
                    const status = Number.parseInt(evmLoan.status) as LoanRecordStatus;

                    return {evmLoan, status}
                };

                const escrowStatus = async (contratcId:string) => {
                    const evmLoan = await  smEscrow().methods.getContract(contratcId).call();
                    const status = Number.parseInt(evmLoan.status) as LoanRecordStatus;

                    return {evmLoan, status}
                };


                return { web3, smOriginator, smEscrow, erc20, encrypter,  decrypter, originatorStatus, escrowStatus};

            } catch (err: any) {
                console.error(`Failed to connect NEInvokedWallet: ${err?.message}`);
                throw new Error(err?.message || (err?.toString()) || 'failed to connect to wallet');
                //return ({error:err});
            }
        },
        []
    );

    return {
        connect,
    };

}

