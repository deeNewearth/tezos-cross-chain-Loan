import { useState } from "react";
import { LoanMetaData } from "../svrProtocol";
import { IAsyncResult, CS_SERVER_URL, fetchJsonAsync, ShowError } from '../providers/utils';
import {
    Alert, Row, Col, Form, InputGroup, Button,
    FormControl, Container, Spinner
} from "react-bootstrap";
import { LoanLine, AddressLine } from '../offChain/search';

import { useConnect as useEvmConnect } from '../providers/web3Loader';
import { useConnect as useTzConnect } from "../providers/tzTemple";

import { parseFees } from '../offChain/newLoan';

import Web3 from 'web3';
import {LoanRecordStatus} from '../svrProtocol';

export default function BobAgrees(p: {
    loan: LoanMetaData;
    updateLoanStatus :(id:string,log:string,status?:LoanRecordStatus)=>any;
    onUpdate?: (l: LoanMetaData) => any
}) {

    const [fees, setFees] = useState(p?.loan.fees?.toString() || '9.99');
    const [submitted, setSubmitted] = useState<IAsyncResult<boolean>>();

    const [confirmed, setConfirmed] = useState<{
        bobBscWallet: string;
        bobTzWallet: string;
    }>();

    const tzConnect = useTzConnect();
    const evmConnect = useEvmConnect();

    

    return <Container className="text-center">

        <Alert variant="success">
            <h3 className="text-success"> Would like to fund the loan</h3>
            <Row className="justify-content-center">
                <LoanLine {...p.loan} />
            </Row>

        </Alert>

        {confirmed && <Alert variant="info" className="my-4">

            <div>
                <h3 className="text-info"> Using wallets</h3>

                <span className="m-5">ETH Wallet <AddressLine assetType="ropsten" address={confirmed.bobBscWallet} /></span>
                <span className="m-5">Tezos Wallet <AddressLine assetType="granadanet" address={confirmed.bobTzWallet} /></span>

                <Button className="m-5" variant="outline-warning" onClick={async () => {

                    setConfirmed(undefined);

                    const { reconnect } = await tzConnect();
                    reconnect();
                }}>Reffersh Wallets</Button>
            </div>

        </Alert>
        }

        <Form onSubmit={async e => {
            e.preventDefault();
            try {
                setSubmitted({ isLoading: true });

                const { web3, encrypter } = await evmConnect();
                if (!confirmed) {
                    
                    const bobBscWallet = (await web3.eth.getAccounts())[0];
                    const { accountPkh: bobTzWallet } = await tzConnect();

                    setConfirmed({ bobBscWallet, bobTzWallet });
                } else {


                    if (p.loan.alexBscWallet == confirmed.bobBscWallet ||
                        p.loan.alexTzWallet == confirmed.bobTzWallet) {
                        throw new Error('This loan is requested using your wallet. You cannot fund it');
                    }

                    const secret2WillgetSoon = web3.utils.sha3(web3.eth.accounts.create(new Date().toString()).privateKey);
                    if(!secret2WillgetSoon)
                        throw new Error('failed to create a secret');
            
                    const encryptedSecret2 = await encrypter(confirmed.bobBscWallet,secret2WillgetSoon);
        


                    const result = await fetchJsonAsync<LoanMetaData>(fetch(`${CS_SERVER_URL}/api/loans`, {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            ...p.loan,
                            ...confirmed,
                            encryptedSecret2,
                            fees: parseFees(fees)
                        })
                    }));

                    if (p.onUpdate) {
                        p.onUpdate(result);
                    }

                }

                setSubmitted({ result: true });

            } catch (error: any) {
                setSubmitted({ error });
            }
        }}>
            <Row className="justify-content-center">
                <Col md={6}>
                    <InputGroup className="mb-3">
                        <InputGroup.Text>I agree with a Fee of</InputGroup.Text>
                        <FormControl
                            required
                            aria-label="1 to 30" value={fees || ''}
                            onChange={e => {
                                setFees((e.target.value || '').replace(/[^0-9.]/g, ''));
                            }}
                        />
                        <InputGroup.Text>Tz</InputGroup.Text>
                    </InputGroup>

                </Col>
            </Row>

            <div className="text-center">
                {submitted?.isLoading && <Spinner animation="grow" variant="success" />}
                {submitted?.error && <ShowError error={submitted.error} />}
                <Button type="submit" disabled={!!submitted?.isLoading} size="lg" variant="primary" className="p-5">Agree to fund</Button>
            </div>


        </Form>


    </Container>;

}