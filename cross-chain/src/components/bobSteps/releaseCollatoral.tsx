import { useState } from "react";
import { LoanMetaData } from "../svrProtocol";
import { IAsyncResult,    ShowError } from '../providers/utils';
import {
    Alert, Row, Button,
     Container, Spinner
} from "react-bootstrap";
import { LoanLine } from '../offChain/search';
import { LoanRecordStatus } from '../svrProtocol';
import { useConnect, SM1_granadanet_address } from "../providers/tzTemple";
import { char2Bytes } from '@taquito/utils';
import { evmPackedSecret, useConnect as useEvmConnect, BSC_CONTRACTS } from "../providers/web3Loader";




export default function ReleaseCollatoral(p: {
    loan: LoanMetaData;
    updateLoanStatus :(id:string,log:string,status?:LoanRecordStatus)=>any;
    onUpdate?: () => any
}) {

    const connect = useConnect();
    const evmConnect = useEvmConnect();
    const [submitted, setSubmitted] = useState<IAsyncResult<boolean>>();

    return <Container className="text-center">

        <Alert variant="success">


            <h4 className="text-success m-4">
                <span> This loan has been returned</span>
            </h4>

            <Row className="justify-content-center">
                <LoanLine {...p.loan} />
            </Row>


            <p>
                Waiting for funder to release the collatoral to get their deposit back
            </p>


        </Alert>

        <div className="text-center">
            {submitted?.isLoading && <Spinner animation="grow" variant="success" />}
            {submitted?.error && <ShowError error={submitted.error} />}


            <Button disabled={!!submitted?.isLoading} variant="primary"
                size="lg" className="p-4 m-4" onClick={async () => {
                    try {

                        setSubmitted({ isLoading: true });
                        const { tezos, accountPkh, tzLoanDetails } = await connect();


                        console.log(`using account ${accountPkh}`);

                        const loanRecord = await tzLoanDetails(p.loan._id);
                        debugger;

                        if (LoanRecordStatus.released != loanRecord.status) {


                            const { web3, smEscrow, decrypter } = await evmConnect();

                            const myAccount = (await web3.eth.getAccounts()).find(a => a == p.loan.bobBscWallet);
                            if (!myAccount || !web3.currentProvider) {
                                throw new Error(`Please sign into Web3 with account ${p.loan.bobBscWallet}`);
                            }

                            if (!p.loan.encryptedSecret2)
                                throw new Error('encryptedSecret2 not set');

                            const secret2_wllchangesoon = await decrypter(myAccount, p.loan.encryptedSecret2);

                            const loanContract = await tezos.wallet.at(SM1_granadanet_address);

                            const opn = await loanContract.methods.releaseCollatoral(
                                char2Bytes(p.loan._id),
                                char2Bytes(secret2_wllchangesoon)
                            ).send({
                            });

                            await p.updateLoanStatus(p.loan._id,"Tz collatoral has been returned");


                            const packedId = web3.utils.sha3(p.loan._id) || '';

                            const done = smEscrow().methods.releaseCollatoral(
                                packedId,
                                evmPackedSecret(secret2_wllchangesoon)
                            );

                            const h = await done.send({ from: myAccount, to: BSC_CONTRACTS.sm1Orginator });

                            await p.updateLoanStatus(p.loan._id,"EVM security deposit has been returned");
                        }



                        await p.updateLoanStatus(p.loan._id, "Collatoral has been returned", LoanRecordStatus.released);
                        if (p.onUpdate)
                            p.onUpdate();

                        setSubmitted({});

                    } catch (error: any) {
                        setSubmitted({ error });

                    }
                }}>
                If you are the loan funder please feel release the collatoral now
            </Button>

        </div>
    </Container>;


}