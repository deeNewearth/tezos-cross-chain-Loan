import { evmPackedSecret } from "../providers/web3Loader";


import { useConnect } from "../providers/tzTemple";

import { useState } from "react";
import { LoanMetaData } from "../svrProtocol";
import { IAsyncResult, CS_SERVER_URL, fetchJsonAsync, ShowError } from '../providers/utils';
import {
    Alert, Row, Col, Form, InputGroup, Button,
    FormControl, Container, Spinner
} from "react-bootstrap";
import { LoanLine, AddressLine, AssetLine } from '../offChain/search';

import { parseFees } from '../offChain/newLoan';
import { char2Bytes } from '@taquito/utils';

import { LoanRecordStatus } from '../svrProtocol';
import Web3 from 'web3';

import { SM1_granadanet_address, TzLoanRecord, tzSecrethash, useConnect as useTzConnect } from "../providers/tzTemple";

import { evmSecrethash, useConnect as useEvmConnect, BSC_CONTRACTS } from "../providers/web3Loader";




export default function MovetEscrow(p: {
    updateLoanStatus :(id:string,log:string,status?:LoanRecordStatus)=>any;
    loan: LoanMetaData;
    onUpdate?: () => any
}) {

    const connect = useConnect();
    const evmConnect = useEvmConnect();
    const [submitted, setSubmitted] = useState<IAsyncResult<boolean>>();

    return <Container className="text-center">

        <Alert variant="success">
            <strong className="text-success">

                User

                <span className="m-5">ETH Wallet <AddressLine assetType="ropsten" address={p.loan.bobBscWallet || ''} /></span>
                <span className="m-5">Tezos Wallet <AddressLine assetType="granadanet" address={p.loan.bobTzWallet || ''} /></span>
            </strong>

            <h4 className="text-success m-4">
                <span> has deposited the funds for this loan</span>
            </h4>

            <Row className="justify-content-center">
                <LoanLine {...p.loan} />
            </Row>

            <p>
                Waiting for loan requester to accepts the funds
            </p>

        </Alert>


        <div className="text-center">
            {submitted?.isLoading && <Spinner animation="grow" variant="success" />}
            {submitted?.error && <ShowError error={submitted.error} />}
            <Button variant="primary" disabled={!!submitted?.isLoading}
                size="lg" className="p-4 m-4" onClick={async () => {
                    try {
                        setSubmitted({isLoading:true});
                        
                        const { tezos, accountPkh, tzLoanDetails, reconnect } = await connect();

                        if (accountPkh != p.loan.alexTzWallet) {
                            reconnect();
                            throw new Error(`Please sign into tezos with account ${p.loan.alexTzWallet}`);
                        }


                        const { web3, smOriginator, decrypter, originatorStatus } = await evmConnect();

                        const myAccount = (await web3.eth.getAccounts()).find(a => a == p.loan.alexBscWallet);
                        if (!myAccount || !web3.currentProvider) {
                            throw new Error(`Please sign into Web3 with account ${p.loan.alexBscWallet}`);
                        }


                        if(!p.loan.encryptedSecret1)
                            throw new Error('encryptedSecret1 not set');
                        const secret1WillgetSoon = await decrypter(myAccount,p.loan.encryptedSecret1);
                        
                        const secret2Byte = char2Bytes(secret1WillgetSoon);

                        const loanRecord = await tzLoanDetails(p.loan._id);


                        if (LoanRecordStatus.bobFunded == loanRecord.status) {

                            const loanContract = await tezos.wallet.at(SM1_granadanet_address);

                            const opn = await loanContract.methods.moveToEscrow(
                                char2Bytes(p.loan._id), secret2Byte
                            ).send();

                            await p.updateLoanStatus(p.loan._id,"Tz collatoral is moved to escrow");

                        }


                        const packedId = web3.utils.sha3(p.loan._id) || '';

                        const evmLoanStat = await originatorStatus(packedId);

                        if(evmLoanStat.status == LoanRecordStatus.bobFunded){

                            if(!p.loan.encryptedSecret1){
                                throw new Error('encryptedSecret1 not found');
                            }
    
                            const packedId = web3.utils.sha3(p.loan._id) || '';
    
                            const done = smOriginator().methods.acceptLoan(
                                packedId,
                                evmPackedSecret(secret1WillgetSoon)
                            );

                            await p.updateLoanStatus(p.loan._id,"EVM funds have been received");
    
                            const h = await done.send({ from: myAccount, to: BSC_CONTRACTS.sm1Orginator });
    
                        }

                        await p.updateLoanStatus(p.loan._id,"loan has been accepted",LoanRecordStatus.movedToEscrow);

                        if(p.onUpdate)
                            p.onUpdate();
                        setSubmitted({});

                    } catch (error: any) {
                        setSubmitted({error});

                    }
                }}>
                If you are the loan requester please procceed
            </Button>

        </div>

    </Container>;


}