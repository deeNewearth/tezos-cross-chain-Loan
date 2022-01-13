import { useState, useEffect } from "react";

import { Modal, Button } from "react-bootstrap";
import { AddressLine } from '../offChain/search';

import { useConnect as useEvmConnect } from '../providers/web3Loader';
import { useConnect as useTzConnect } from "../providers/tzTemple";
import { resolve } from "dns";

type TheWallets = {
    bscWallet:string; tzWallet:string;
}

export default function useConfirmWallet() {

    const tzConnect = useTzConnect();
    const evmConnect = useEvmConnect();

    const [confirmed, setConfirmed] = useState<TheWallets>();

    const resolver ={
        resolve:(w:TheWallets)=>w,
        reject:()=>{},
    };



    async function confirmWallets(){

        const { web3 } = await evmConnect();
        const bscWallet = (await web3.eth.getAccounts())[0];
        const { accountPkh: tzWallet } = await tzConnect();
        
        setConfirmed({ bscWallet, tzWallet });

        /*
        try{
        await new Promise<TheWallets>((resolve,reject)=>{
            resolver.resolve = resolve;
            resolver.reject=reject;
        });
        }catch(err){
            return null;
        }
        finally{
            setConfirmed(undefined);
        }
        */


        return confirmed;
    }

    function ConfirmView() {

        if(!confirmed)
            return <div></div>;
        
        return <Modal show={true} onHide={()=>resolver.reject()}>
            <Modal.Header closeButton>
                <Modal.Title>Using wallets</Modal.Title>
            </Modal.Header>

            <Modal.Body>
                <span className="m-5">ETH Wallet <AddressLine assetType="ropsten" 
                                address={confirmed.bscWallet} /></span>
                <span className="m-5">Tezos Wallet <AddressLine assetType="granadanet" 
                    address={confirmed.tzWallet} /></span>
            </Modal.Body>

            <Modal.Footer>
                <Button variant="primary" size="lg" className="p-3" onClick={()=>{
                    resolver.resolve(confirmed);
                }}>
                    Go ahead
                </Button>
            </Modal.Footer>
        </Modal>;
    }

    return {confirmWallets, ConfirmView};

}