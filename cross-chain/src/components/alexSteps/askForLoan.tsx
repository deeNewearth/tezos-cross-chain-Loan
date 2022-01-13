//import {LoanReq} from '../../../../tzApp/src/SubModule';
import { useState } from "react";
import { LoanMetaData } from "../svrProtocol";
import { IAsyncResult, ShowError, updateField } from '../providers/utils';
import {
    Alert, Row, Col, Form, InputGroup, Button,
    FormControl, Container, Spinner
} from "react-bootstrap";
import { LoanLine, AddressLine } from '../offChain/search';

import { parseFees } from '../offChain/newLoan';
import { char2Bytes } from '@taquito/utils';
import {LoanRecordStatus} from '../svrProtocol';


import { SM1_granadanet_address, TzLoanRecord, tzSecrethash, useConnect as useTzConnect } from "../providers/tzTemple";

import { evmSecrethash, useConnect as useEvmConnect, BSC_CONTRACTS } from "../providers/web3Loader";


export default function AskForLoan(p: {
    loan: LoanMetaData;
    updateLoanStatus :(id:string,log:string,status?:LoanRecordStatus)=>any;
    onUpdate?: () => any
}) {

    const tzConnect = useTzConnect();
    const evmConnect = useEvmConnect();
    const [submitted, setSubmitted] = useState<IAsyncResult<boolean>>();

    

    async function setUpnewLoan(loan: TzLoanRecord) {
        debugger;

        const { web3, smOriginator, decrypter } = await evmConnect();

        const myAccount = (await web3.eth.getAccounts()).find(a => a == p.loan.alexBscWallet);
        if (!myAccount || !web3.currentProvider) {
            throw new Error(`Please sign into Web3 with account ${p.loan.alexBscWallet}`);
        }

        const packedId = web3.utils.sha3(p.loan._id) || '';

        //const smOriginator:Sm1GiverOriginator = new web3.eth.Contract(sm1Json.abi as any, BSC_CONTRACTS.sm1Orginator) as any;

        //'0x7465737400000000000000000000000000000000000000000000000000000000', 
        //const packedId = web3.utils.padLeft(web3.utils.fromUtf8(contractId), 32);

        

        if(!p.loan.encryptedSecret1)
            throw new Error('encryptedSecret1 not set');
        const secret1WillgetSoon = await decrypter(myAccount,p.loan.encryptedSecret1);

        const done = smOriginator().methods.askForLoan(
            packedId,
            p.loan.bscAssetContract.address,
            web3.utils.toWei(loan.req.amount.toString(), 'ether'),

            evmSecrethash(web3, secret1WillgetSoon),//packedSecret,

            Date.parse(loan.reqTill).valueOf(),
            Date.parse(loan.acceptTill).valueOf(),
            Date.parse(loan.lockedTill).valueOf(),
            Date.parse(loan.releaseTill).valueOf()
        );

        await p.updateLoanStatus(p.loan._id,"Evm loan has been set");

        const h = await done.send({ from: myAccount, to: BSC_CONTRACTS.sm1Orginator });

        

    }

    async function setUpcollatoral() {
        const { tezos, accountPkh, tzLoanDetails, reconnect } = await tzConnect();


        if (accountPkh != p.loan.alexTzWallet) {
            reconnect();
            throw new Error(`Please sign into tezos with account ${p.loan.alexTzWallet}`);
        }

        console.log(`using account ${accountPkh}`);

        const asset = await tezos.wallet.at(p.loan.tzAssetContract.address);
        const loanContract = await tezos.wallet.at(SM1_granadanet_address);

        const byContractId = char2Bytes(p.loan._id);

        const contractDetails = await tzLoanDetails(p.loan._id);
        if (!!contractDetails) {
            console.log(`contract ${p.loan._id} exists`);
            return contractDetails;
        }

        const { web3, decrypter } = await evmConnect();

        const myAccount = (await web3.eth.getAccounts()).find(a => a == p.loan.alexBscWallet);
        if (!myAccount || !web3.currentProvider) {
            throw new Error(`Please sign into Web3 with account ${p.loan.alexBscWallet}`);
        }

        if(!p.loan.encryptedSecret1)
            throw new Error('encryptedSecret1 not set');
        const secret1WillgetSoon = await decrypter(myAccount,p.loan.encryptedSecret1);
    
        
        const hash1 = tzSecrethash(secret1WillgetSoon);

        let currentAprovs = 0;

        const storage: any = await asset.storage();
        const balances = await storage.balances.get(accountPkh);

        if (balances) {
            const k: BigInteger = balances.approvals.get(SM1_granadanet_address);
            //                    const k:BigInteger = balances.approvals?.get('tz1XXyXcPA2PRMawosyZ7WDtxueyq5rvvZ93');

            if (k) {
                currentAprovs = Number.parseFloat(k.toString());
            }
        }




        if (p.loan.amount > currentAprovs) {
            currentAprovs = (p.loan.amount - currentAprovs);

            const appvOpn = await asset.methods.approve(SM1_granadanet_address, p.loan.amount).send();
            await p.updateLoanStatus(p.loan._id,"Tz collatoral has been approved");

        } else {
            console.log('no approvals needed');
        }

        //askForLoan(address alexTzWallet, nat amount, address bobsTzWallet, bytes contractId, mutez fees, 
        //int loanDuration, bytes secret1Hash, bytes secret1Store, address tzAssetContract)

        const opn = await loanContract.methods.askForLoan(
            p.loan.alexTzWallet,
            p.loan.amount,
            p.loan.bobTzWallet,
            byContractId,
            p.loan.fees * 1000 * 1000,
            p.loan.loanDuration,
            hash1,//loan.secret1Hash,
            p.loan.encryptedSecret1.substring(2), //remove 0x
            p.loan.tzAssetContract.address

        ).send({
            amount: p.loan.fees
        });

        await p.updateLoanStatus(p.loan._id,"Tz loan has been set");

        const results = await opn.confirmation();

        //await wallet.reconnect('granadanet');

        //const h1 = results;
        return await tzLoanDetails(p.loan._id);

    }

    return <Container className="text-center">

        <Alert variant="success">
            <strong className="text-success">

                User

                <span className="m-5">ETH Wallet <AddressLine assetType="ropsten" address={p.loan.bobBscWallet || ''} /></span>
                <span className="m-5">Tezos Wallet <AddressLine assetType="granadanet" address={p.loan.bobTzWallet || ''} /></span>
            </strong>

            <h4 className="text-success m-4">
                <span> has agreed to fund this loan</span>

            </h4>
            <Row className="justify-content-center">
                <LoanLine {...p.loan} />
            </Row>

        </Alert>


        <div className="text-center">
            {submitted?.isLoading && <Spinner animation="grow" variant="success" />}
            {submitted?.error && <ShowError error={submitted.error} />}

            <Button variant="primary"disabled={!!submitted?.isLoading}
                 size="lg" className="p-4 m-4" onClick={async () => {
                try {
                    setSubmitted({ isLoading: true });

                    const tzLoan = await setUpcollatoral();

                    await setUpnewLoan(tzLoan);

                    await p.updateLoanStatus(p.loan._id,"loan collatoral is ready", tzLoan.status);

                    if (p.onUpdate) {
                        p.onUpdate();
                    }


                } catch (error: any) {
                    setSubmitted({ error });

                }
            }}>
                If you are the loan requester please procceed
            </Button>
        </div>


    </Container>;


}