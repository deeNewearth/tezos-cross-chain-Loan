import { useState } from "react";
import { LoanMetaData } from "../svrProtocol";
import { IAsyncResult, CS_SERVER_URL, fetchJsonAsync, ShowError } from '../providers/utils';
import {
    Alert, Row, Col, Form, InputGroup, Button,
    FormControl, Container, Spinner
} from "react-bootstrap";
import { LoanLine, AddressLine, AssetLine } from '../offChain/search';

import { parseFees } from '../offChain/newLoan';

import { LoanRecordStatus } from '../svrProtocol';


import { TzLoanRecord, tzSecrethash, useConnect as useTzConnect } from "../providers/tzTemple";


import { useConnect, SM1_granadanet_address } from "../providers/tzTemple";
import { char2Bytes } from '@taquito/utils';
import Web3 from 'web3';

import { evmSecrethash, useConnect as useEvmConnect, aprroveFunds, BSC_CONTRACTS } from "../providers/web3Loader";




export default function GetItBack(p: {
    loan: LoanMetaData;
    updateLoanStatus: (id: string, log: string, status?: LoanRecordStatus) => any;
    onUpdate?: () => any
}) {

    const connect = useConnect();
    const evmConnect = useEvmConnect();
    const [submitted, setSubmitted] = useState<IAsyncResult<boolean>>();

    return <Container className="text-center">

        <Alert variant="success">


            <h4 className="text-success m-4">
                <span> This loan is ongoing</span>
            </h4>

            <Row className="justify-content-center">
                <LoanLine {...p.loan} />
            </Row>



        </Alert>

        <div className="text-center">
            {submitted?.isLoading && <Spinner animation="grow" variant="success" />}
            {submitted?.error && <ShowError error={submitted.error} />}


            <Button variant="primary" disabled={!!submitted?.isLoading}
                size="lg" className="p-4 m-4" onClick={async () => {
                    try {

                        setSubmitted({ isLoading: true });

                        debugger;

                        const { web3, smEscrow, erc20, escrowStatus } = await evmConnect();
                        const myAccount = (await web3.eth.getAccounts()).find(a => a == p.loan.alexBscWallet);
                        if (!myAccount || !web3.currentProvider) {
                            throw new Error(`Please sign into Web3 with account ${p.loan.alexBscWallet}`);
                        }

                        const packedId = web3.utils.sha3(p.loan._id) || '';

                        const evmLoanStat = await escrowStatus(packedId);

                        if (evmLoanStat.status == LoanRecordStatus.bobFunded) {
                            
                            const depositAmt = await aprroveFunds(web3,
                                p.loan.bscAssetContract.address, erc20(p.loan.bscAssetContract.address),
                                p.loan.amount,
                                p.loan.alexBscWallet,
                                BSC_CONTRACTS.sm2Escrow
                            );

                            await p.updateLoanStatus(p.loan._id,"EVM return is approved");


                            const done = smEscrow().methods.LoanComplete(
                                packedId,
                                depositAmt
                            );

                            await p.updateLoanStatus(p.loan._id,"EVM funds have been returned to escrow");

                            const h = await done.send({ from: myAccount, to: BSC_CONTRACTS.sm2Escrow });


                        }





                        await p.updateLoanStatus(p.loan._id, "loan has been returned", LoanRecordStatus.returned);
                        if (p.onUpdate)
                            p.onUpdate();

                        setSubmitted({});

                    } catch (error: any) {
                        setSubmitted({ error });

                    }
                }}>
                If you are the loan requester please feel free to return at any time

            </Button>

        </div>
    </Container>;


}