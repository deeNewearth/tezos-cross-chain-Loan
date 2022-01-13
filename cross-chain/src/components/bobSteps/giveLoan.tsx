import {
    aprroveFunds,

} from "../providers/web3Loader";

import { useConnect } from "../providers/tzTemple";

import { useState } from "react";
import { LoanMetaData } from "../svrProtocol";
import { IAsyncResult, updateField, fetchJsonAsync, ShowError } from '../providers/utils';
import {
    Alert, Row, Col, Form, InputGroup, Button,
    FormControl, Container, Spinner
} from "react-bootstrap";
import { LoanLine, AddressLine, AssetLine } from '../offChain/search';

import { parseFees } from '../offChain/newLoan';
import { char2Bytes } from '@taquito/utils';

import { LoanRecordStatus } from '../svrProtocol';


import { SM1_granadanet_address, TzLoanRecord, tzSecrethash, useConnect as useTzConnect } from "../providers/tzTemple";

import { evmSecrethash, useConnect as useEvmConnect, BSC_CONTRACTS } from "../providers/web3Loader";


export default function GiveLoan(p: {
    loan: LoanMetaData;
    updateLoanStatus: (id: string, log: string, status?: LoanRecordStatus) => any;
    onUpdate?: () => any
}) {

    const connect = useConnect();
    const evmConnect = useEvmConnect();
    const [submitted, setSubmitted] = useState<IAsyncResult<boolean>>();

    return <Container className="text-center">

        <Alert variant="success">
            <strong className="text-success">

                User

                <span className="m-5">ETH Wallet <AddressLine assetType="ropsten" address={p.loan.alexBscWallet || ''} /></span>
                <span className="m-5">Tezos Wallet <AddressLine assetType="granadanet" address={p.loan.alexTzWallet || ''} /></span>
            </strong>

            <h4 className="text-success m-4">
                <span> has deposited collatoral for this loan</span>
            </h4>

            <Row className="justify-content-center">
                <LoanLine {...p.loan} />
            </Row>

            <p>
                Waiting for funder to deposit {2 * p.loan.amount}
                &nbsp;<AssetLine assetType="ropsten" {...p.loan.bscAssetContract} />&nbsp;
                (loan funds + deposit )
            </p>

        </Alert>

        <div className="text-center">
            {submitted?.isLoading && <Spinner animation="grow" variant="success" />}
            {submitted?.error && <ShowError error={submitted.error} />}
            <Button variant="primary" disabled={!!submitted?.isLoading}

                size="lg" className="p-4 m-4" onClick={async () => {

                    try {
                        setSubmitted({ isLoading: true });

                        const { tezos, accountPkh, tzLoanDetails, reconnect } = await connect();

                        if (accountPkh != p.loan.bobTzWallet) {
                            reconnect();
                            throw new Error(`Please sign into tezos with account ${p.loan.bobTzWallet}`);
                        }

                        const { web3, smOriginator, erc20, decrypter, originatorStatus } = await evmConnect();
                        const myAccount = (await web3.eth.getAccounts()).find(a => a == p.loan.bobBscWallet);
                        if (!myAccount || !web3.currentProvider) {
                            throw new Error(`Please sign into Web3 with account ${p.loan.bobBscWallet}`);
                        }

                        const loanRecord = await tzLoanDetails(p.loan._id);

                        if (!p.loan.encryptedSecret2)
                            throw new Error('encryptedSecret1 not set');
                        const secret2_wllchangesoon = await decrypter(myAccount, p.loan.encryptedSecret2);

                        if (!secret2_wllchangesoon)
                            throw new Error('failed to create a secret');

                        if (LoanRecordStatus.created == loanRecord.status) {


                            const loanContract = await tezos.wallet.at(SM1_granadanet_address);

                            const hash2 = tzSecrethash(secret2_wllchangesoon);

                            const opn = await loanContract.methods.setUpSecret2(
                                char2Bytes(p.loan._id),
                                hash2,
                                p.loan.encryptedSecret2.substring(2)//remove0x
                            ).send();

                            await p.updateLoanStatus(p.loan._id,"Tz loan has been updated");

                        }


                        const packedId = web3.utils.sha3(p.loan._id) || '';

                        if (!p.loan.bobBscWallet) {
                            throw new Error('loan provider\'s ETH wallet is not set')
                        }

                        const evmLoanStat = await originatorStatus(packedId);

                        if (evmLoanStat.status == LoanRecordStatus.created) {

                            const depositAmt = await aprroveFunds(web3,
                                p.loan.bscAssetContract.address, erc20(p.loan.bscAssetContract.address),
                                2 * p.loan.amount,
                                p.loan.bobBscWallet,
                                BSC_CONTRACTS.sm1Orginator
                            );

                            await p.updateLoanStatus(p.loan._id,"EVM deposit is approved");

                            //const packedSecret = web3.utils.sha3(loanReq.secret2)||'';



                            const done = smOriginator().methods.giveLoan(
                                packedId,
                                depositAmt,
                                evmSecrethash(web3, secret2_wllchangesoon)//packedSecret
                            );

                            await p.updateLoanStatus(p.loan._id,"EVM amount is deposited");

                            const h = await done.send({ from: myAccount, to: BSC_CONTRACTS.sm1Orginator });
                        }

                        await p.updateLoanStatus(p.loan._id, "loan is funded", LoanRecordStatus.bobFunded);

                        if (p.onUpdate)
                            p.onUpdate();


                        setSubmitted({ result: true });

                    } catch (error: any) {
                        setSubmitted({ error });
                    }
                }}>
                If you are the loan funder please procceed
            </Button>

        </div>

    </Container>;


}