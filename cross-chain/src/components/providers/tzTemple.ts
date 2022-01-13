import { useEffect, useState, useRef, useCallback } from 'react';
import constate from 'constate';
//import { ThanosWallet, ThanosDAppNetwork } from '@thanos-wallet/dapp';
import { TempleWallet as NEInvokedWallet, TempleDAppNetwork as NEInvokedNetwork } from "@temple-wallet/dapp";
import { TezosToolkit } from '@taquito/taquito';
import { SHA3, Keccak } from 'sha3';
import { char2Bytes } from '@taquito/utils';
import {LoanRecordStatus} from '../svrProtocol';

export const SM1_granadanet_address = 'KT1B4E5jnE42umeWb7HrnhgSrGPSxtR6JgCG';

export const GRANANET_RPC = "https://granadanet.api.tez.ie";

export function tzSecrethash(secret: string) {

    const hash = new SHA3(256);

    hash.update(secret);

    const j = hash.digest({ buffer: Buffer.alloc(32), format: 'hex' });

    return j;
}


export type TzLoanRecord = {
    acceptTill: string, //"2021-11-07T06:55:57.000Z",
    lockedTill: string,//"2021-11-18T06:55:57.000Z",
    preimage: string,//"646673642032333233206173736473642073647364",
    releaseTill: string,//"2021-11-19T06:55:57.000Z",
    req: {
        alexTzWallet: string,//"tz1Ym9xTxJ3w4oSqZC3wiQSQ195dKxfCf9F8",
        amount: string,//"6",
        bobsTzWallet:string,   //"tz1XXyXcPA2PRMawosyZ7WDtxueyq5rvvZ93",
        fees: string, //"1000000",
        loanDuration: string, //"10",
        secret1Hash: string, //"2681442629a817fd1f1430ddba28431102d0572f7d89414d56a8fb3a55c16ea2",
        tzAssetContract: string, //"KT1JNrJTfr5X9o1LpBn2PNvMPYk4g6guV9ig"
    },
    reqTill: string,//"2021-11-07T06:55:57.000Z",
    secret2Hash: string, //"813b8dc3ea89b2e4b44a4602ce5aeb92c46f111018296c509f45cead59aedeae",
    status: LoanRecordStatus //"7"
};


export const [
    DAppProvider,
    useWallet,
    useTezos,
    useAccountPkh,
    useReady,
    useConnect,
] = constate(
    useDApp,
    (v) => v.wallet,
    (v) => v.tezos,
    (v) => v.accountPkh,
    (v) => v.ready,
    (v) => v.connect
);

function useDApp(props: { appName: string }) {
    const { appName } = props;

    const [{ wallet, tezos, accountPkh }, setState] = useState<{ wallet?: NEInvokedWallet; tezos?: TezosToolkit; accountPkh?: string }>(() => ({
        wallet: undefined,
        tezos: undefined,
        accountPkh: undefined,
    }));

    const ready = Boolean(tezos);

    useEffect(() => {
        return NEInvokedWallet.onAvailabilityChange(async (available) => {

            if (available) {
                let perm;
                try {
                    perm = await NEInvokedWallet.getCurrentPermission();
                } catch { }

                const wlt = new NEInvokedWallet(appName, perm);
                setState({
                    wallet: wlt,
                    tezos: wlt.connected ? wlt.toTezos() : undefined,
                    accountPkh: wlt.connected ? await wlt.getPKH() : undefined,
                });
            } else {
                setState({
                    wallet: undefined,
                    tezos: undefined,
                    accountPkh: undefined,
                });
            }
        });
    }, [appName, setState]);

    useEffect(() => {
        if (wallet && wallet.connected) {
            return NEInvokedWallet.onPermissionChange((perm) => {
                if (!perm) {
                    setState({
                        wallet: new NEInvokedWallet(appName),
                        tezos: undefined,
                        accountPkh: undefined,
                    });
                }
            });
        }
    }, [wallet, appName, setState]);

    const connect = useCallback(
        async (network: NEInvokedNetwork = 'granadanet', opts?: { forcePermission: boolean }) => {
            try {
                if (!wallet) {
                    throw new Error('Temple Wallet is not available');
                }

                const loadtezos = async ()=>{
                    if (!!tezos && !!accountPkh) {
                        console.log('we are already connected');
                        return { wallet, tezos, accountPkh };
                    } else {
                        console.log('Connecting to wallet');
                    }
    
                    await wallet.connect(network, opts);
                    const tzs = wallet.toTezos();
                    const pkh = await tzs.wallet.pkh();
    
    
                    const toRet = {
                        wallet,
                        tezos: tzs,
                        accountPkh: pkh,
                    };
    
                    setState(toRet);
                    return toRet;
    
                };

                const tzRet = await loadtezos();

                const tzLoanDetails = async (contractId:string)=>{
                    const byContractId = char2Bytes(contractId);
                    const loanContract = await tzRet.tezos.wallet.at(SM1_granadanet_address);
                    const loanStorage:any = await loanContract.storage(); 

                    const k1:TzLoanRecord = await loanStorage.get(byContractId);

                    let s:LoanRecordStatus|undefined;
                    if (typeof k1?.status === 'string' ){
                        k1.status= Number.parseInt(k1?.status as string);
                    }            

                    return k1;
                }

                return ({...tzRet,tzLoanDetails,
                     reconnect: (n: NEInvokedNetwork = 'granadanet')=>wallet.reconnect(n)
                    });


            } catch (err: any) {
                console.error(`Failed to connect NEInvokedWallet: ${err?.message}`);
                throw new Error(err?.message || (err?.toString()) || 'failed to connect to wallet');
                //return ({error:err});
            }
        },
        [setState, wallet]
    );

    return {
        wallet,
        tezos,
        accountPkh,
        ready,
        connect,
    };
}

export function useOnBlock(tezos: TezosToolkit, callback: (h: string) => any) {
    const blockHashRef = useRef();

    useEffect(() => {
        let sub: any;
        spawnSub();
        return () => sub.close();

        function spawnSub() {
            sub = tezos.stream.subscribe('head');

            sub.on('data', (hash: any) => {
                if (blockHashRef.current && blockHashRef.current !== hash) {
                    callback(hash);
                }
                blockHashRef.current = hash;
            });
            sub.on('error', (err: any) => {
                if (process.env.NODE_ENV === 'development') {
                    console.error(err);
                }
                sub.close();
                spawnSub();
            });
        }
    }, [tezos, callback]);
}