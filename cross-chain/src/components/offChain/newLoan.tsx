import {
    Alert, Container,
    Form, InputGroup, Button, DropdownButton, Dropdown,
    FormControl, Row, Col, Spinner

} from 'react-bootstrap';

import { useState } from 'react';

import Web3 from 'web3';

import { TestGTC } from '../../generatedTypes/web3-v1-contracts/TestGTC';
import erc20Json from '../providers/erc20.json';

import { TezosToolkit } from '@taquito/taquito';

import { RUPTEN_RPC, useConnect as useEvmConnect } from '../providers/web3Loader';
import { GRANANET_RPC, useConnect as useTzConnect } from "../providers/tzTemple";

import { IAsyncResult, CS_SERVER_URL, fetchJsonAsync, ShowError , updateField} from '../providers/utils';

import { LoanMetaData, AssetContract } from '../svrProtocol';

import { LoanLine, AddressLine } from '../offChain/search';


//const RUP_TEST_TOKEN = "0x722dd3F80BAC40c951b51BdD28Dd19d435762180";

type AssetDetails = {
    details?: IAsyncResult<AssetContract>,
    userInput?: string;
};

export function parseFees(fees: string) {
    const feesNumber = Number.parseFloat(fees || '');
    if (!feesNumber || feesNumber < 5) {
        throw new Error('fees must be greater then 5');
    }

    return feesNumber;

}

export default function NewLoan(props?: { onNew?: (l: LoanMetaData) => any }) {

    const tzConnect = useTzConnect();
    const evmConnect = useEvmConnect();


    const [amount, setAmount] = useState<number>(1);
    const [tzAssetContract, setTzAssetContract] = useState<AssetDetails>({ userInput: 'KT1Sxi4RdFmhuZFsJcpCk34e6Mv3otEjZ4Ag' });
    const [bscAssetContract, setBscAssetContract] = useState<AssetDetails>({ userInput: '0x4f3b397423a83f7db2fdbe7a98fd34f0ea2c748a' });
    const [loanDuration, setLoanDuration] = useState<number>(7);
    const [fees, setFees] = useState('9.99');
    const [submitted, setSubmitted] = useState<IAsyncResult<LoanMetaData>>();

    const [confirmed, setConfirmed] = useState<{
        alexBscWallet: string;
        alexTzWallet: string;
    }>();


    async function lookupTz() {
        try {
            if (!tzAssetContract?.userInput) {
                return;
            }

            setTzAssetContract({ ...tzAssetContract, details: { isLoading: true } });


            const tezos = new TezosToolkit(GRANANET_RPC);

            const fa1_2 = await tezos.contract.at(tzAssetContract.userInput);

            const mexists = await fa1_2.methods['transfer'];
            if (!mexists) {
                throw new Error('failed to validate address');
            }

            const id = tzAssetContract.userInput;
            setTzAssetContract({
                ...tzAssetContract, details: {
                    result: {
                        symbol: `${id.substring(0, 2)}...${id.substring(id.length - 3)}`,
                        address: tzAssetContract.userInput
                    }
                }
            });

        } catch (err) {
            setTzAssetContract({ ...tzAssetContract, details: { error: err as Error } });
        }

    }



    async function lookupBsc() {
        try {
            if (!bscAssetContract?.userInput) {
                return;
            }

            setBscAssetContract({ ...bscAssetContract, details: { isLoading: true } });

            //const { web3, erc20 } = await evmConnect();

            const p = new Web3.providers.HttpProvider(RUPTEN_RPC);
            const web3 = new Web3(p);
            const erc20i: TestGTC = new web3.eth.Contract(erc20Json as any, bscAssetContract.userInput) as any;


            //const erc20i = erc20(bscAssetContract?.userInput);

            const symbol = await erc20i.methods.symbol().call();
            const description = await erc20i.methods.name().call();

            setBscAssetContract({
                ...bscAssetContract, details: {
                    result: {
                        symbol,
                        description,
                        address: bscAssetContract.userInput
                    }
                }
            });

        } catch (err) {
            setBscAssetContract({ ...bscAssetContract, details: { error: err as Error } });
        }

    }

    async function submitLoan() {
        try {

            const { web3, encrypter } = await evmConnect();
            if (!confirmed) {
                const alexBscWallet = (await web3.eth.getAccounts())[0];
                const { accountPkh: alexTzWallet } = await tzConnect();

                setConfirmed({ alexBscWallet, alexTzWallet });
                return;
            }

            setSubmitted({ isLoading: true });
            if (!bscAssetContract?.details?.result || !tzAssetContract?.details?.result)
                throw new Error('contracts are not validated');
            if (loanDuration < 1)
                throw new Error('duration must be greater then 1');

            if (amount < 1) {
                throw new Error('amount must be greater then 1');
            }

            const secret1WillgetSoon = web3.utils.sha3(web3.eth.accounts.create(new Date().toString()).privateKey);
            if(!secret1WillgetSoon)
                throw new Error('failed to create a secret');
    
            const encryptedSecret1 = await encrypter(confirmed.alexBscWallet,secret1WillgetSoon);

            const loan: LoanMetaData = {
                submittedOn: new Date(),
                amount,
                loanDuration,
                fees: parseFees(fees),
                tzAssetContract: tzAssetContract.details.result,
                bscAssetContract: bscAssetContract.details.result,
                
                encryptedSecret1,

                ...confirmed
            };

            const result = await fetchJsonAsync<LoanMetaData>(fetch(`${CS_SERVER_URL}/api/loans`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loan)
            }));

            if (props?.onNew) {
                props?.onNew(result);
            }
            setSubmitted(undefined);
            setBscAssetContract({});

        } catch (error: any) {
            setSubmitted({ error });
        }
    }

    const doLoan = !!(tzAssetContract?.details?.result && bscAssetContract?.details?.result);

    return <Container >

        <Alert variant="info">

            <h4>This is a MVP for a hackathon</h4>

            <ul>
                <li>We will be adding "search" and "match" features as we go on.<br />
                    for now we just list all loans in cronological order
                </li>
                <li>We will add book making where suggested fees/interest rate is calculated by investment models</li>
                <li>To know about this process browse to the <a href="https://github.com/shreedee/tezos-cross-chain-Loan/blob/main/docs/ne%20cross%20chain%20loans%20-%20litepaper.pdf" target="_blank"> White-Paper </a>  </li>
            </ul>


        </Alert>

        <hr />

        {confirmed && <Alert variant="info" className="my-4">

            <div>
                <h3 className="text-info"> Using wallets</h3>

                <span className="m-5">ETH Wallet <AddressLine assetType="ropsten" address={confirmed.alexBscWallet} /></span>
                <span className="m-5">Tezos Wallet <AddressLine assetType="granadanet" address={confirmed.alexTzWallet} /></span>

                <Button className="m-5" variant="outline-warning" onClick={async () => {

                    setConfirmed(undefined);

                    const { reconnect } = await tzConnect();
                    reconnect();
                }}>Reffersh Wallets</Button>
            </div>

        </Alert>
        }


        <Form className="my-5" onSubmit={e => {
            e.preventDefault();

            if (doLoan) {
                submitLoan();
                return;
            }

            lookupBsc();
            lookupTz();
        }}>
            <h2>Apply for a new Loan </h2>
            <Row>
                <Col lg>
                    <Form.Label>I want to borrow</Form.Label>
                    <Row>
                        <Col sm={3}>
                            <FormControl required type="number" placeholder="NNN" value={amount || undefined}
                                onChange={e => setAmount(Number.parseInt(e.target.value))}
                            />
                        </Col>
                        <Col sm={9}>
                            <Form.Group className="mb-3" >
                                <InputGroup className="mb-3" hasValidation>
                                    <FormControl placeholder="ERC20 contract address"
                                        required
                                        isInvalid={!!bscAssetContract?.details?.error}
                                        isValid={!!bscAssetContract?.details?.result}

                                        value={bscAssetContract?.userInput || ''}
                                        onChange={e => setBscAssetContract({ userInput: e.target.value })}
                                    />
                                    <DropdownButton
                                        variant="outline-secondary"
                                        title="Ropsten (ETH)"
                                        id="input-group-dropdown-2"
                                        align="end"
                                    >
                                        <Dropdown.Item href="#">Ropsten (ETH)</Dropdown.Item>
                                    </DropdownButton>
                                    {bscAssetContract?.details?.error && <Form.Control.Feedback type="invalid">
                                        {bscAssetContract?.details?.error.toString()}
                                    </Form.Control.Feedback>
                                    }
                                    {bscAssetContract?.details?.result && <Form.Control.Feedback type="valid">
                                        {bscAssetContract?.details.result.symbol} - {bscAssetContract?.details.result.description}
                                    </Form.Control.Feedback>
                                    }

                                </InputGroup>
                            </Form.Group>

                        </Col>
                    </Row>



                </Col>
                <Col lg>
                    <Form.Label>against my</Form.Label>
                    <Row>
                        <Col sm={3}>
                            <FormControl readOnly type="number" value={amount || undefined} />
                        </Col>
                        <Col sm={9}>
                            <Form.Group className="mb-3" >
                                <InputGroup className="mb-3" hasValidation>
                                    <FormControl placeholder="FA1.2 contract address"
                                        required
                                        isInvalid={!!tzAssetContract?.details?.error}
                                        isValid={!!tzAssetContract?.details?.result}

                                        value={tzAssetContract?.userInput || ''}
                                        onChange={e => setTzAssetContract({ userInput: e.target.value })}
                                    />
                                    <DropdownButton
                                        variant="outline-secondary"
                                        title="Granadanet (Tz)"
                                        id="input-group-dropdown-2"
                                        align="end"
                                    >
                                        <Dropdown.Item href="#">Ropsten (ETH)</Dropdown.Item>
                                    </DropdownButton>

                                    {tzAssetContract?.details?.error && <Form.Control.Feedback type="invalid">
                                        {tzAssetContract?.details?.error.toString()}
                                    </Form.Control.Feedback>
                                    }

                                </InputGroup>
                            </Form.Group>
                        </Col>
                    </Row>

                </Col>
            </Row>

            <Row className="justify-content-center">
                <Col md={4}>
                    <InputGroup className="mb-3">
                        <InputGroup.Text>for</InputGroup.Text>
                        <FormControl type="number"
                            required
                            min={1} max={30} aria-label="1 to 30" value={loanDuration || undefined}
                            onChange={e => {
                                const n = Number.parseInt(e.target.value);
                                if (n > 30 || n <= 0) {
                                    setLoanDuration(7);
                                } else {
                                    setLoanDuration(n);
                                }

                            }}
                        />
                        <InputGroup.Text>days</InputGroup.Text>
                    </InputGroup>
                </Col>
                <Col md={4}>
                    <InputGroup className="mb-3">
                        <InputGroup.Text>and will pay fees of</InputGroup.Text>
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

            {(bscAssetContract?.details?.isLoading || tzAssetContract?.details?.isLoading)
                && <Spinner animation="border" />}

            <div className="d-grid gap-4 text-center">

                {submitted?.isLoading && <div className="text-center"><Spinner animation="border" variant="primary" /></div>}
                {submitted?.error && <ShowError error={submitted.error} />}

                <Button variant="primary" type="submit" disabled={!!submitted?.isLoading} >
                    {doLoan ? 'Seek a loan' : 'Validate Contracts Address'}
                </Button>
            </div>
        </Form>

        <hr />


    </Container>;
}