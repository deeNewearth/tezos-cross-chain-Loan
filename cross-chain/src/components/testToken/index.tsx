import { useState } from "react";

import { Toast, Button, Container, Spinner } from "react-bootstrap";
import { useConnect as useTzConnect } from "../providers/tzTemple";
import { useConnect as useEvmConnect } from "../providers/web3Loader";


import { IAsyncResult, ShowError } from '../providers/utils';


//const DEE_DEPLOYED_ADDRESS ='tz1bLBkLUWcnQbCC8pCcjtwZvekLUwPPEsRq';

//granadanet
export const TEST_TZ_TOKEN_ADDRESS = 'KT1Sxi4RdFmhuZFsJcpCk34e6Mv3otEjZ4Ag';

//ropsten
export const TEST_BSC_ASSET = '0x4f3b397423a83f7db2fDbe7a98fD34f0EA2c748a';
//const TEST_BSC_ASSET = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';



export default function ManageTestToken() {
    const tzConnect = useTzConnect();
    const evmConnect = useEvmConnect();

    const [mint, setMint] = useState<IAsyncResult<string>>();
    const [confirm, setConfirm] = useState<IAsyncResult<string>>();

    async function updateConfirmation(opn: () => PromiseLike<string>) {
        try {
            setConfirm({ isLoading: true });

            const result = await opn();

            setConfirm({ result });

        } catch (error: any) {
            console.log(`failed to confirm ${error}`);
            setConfirm({ error });
        }
    }

    async function mintEvm() {
        try {
            setMint({ isLoading: true });
            setConfirm(undefined);

            const { web3, erc20 } = await evmConnect();

            const erc20instance = erc20(TEST_BSC_ASSET);

            const myAccount = (await web3.eth.getAccounts())[0];
            if (!myAccount || !web3.currentProvider) {
                throw new Error(`Please sign into Web3 with account`);
            }

            const opn = await erc20instance.methods.giveMe().send(
                {from: myAccount, to: TEST_BSC_ASSET}
            );

            setMint({ result: `https://ropsten.etherscan.io/tx/${opn?.transactionHash}` });

            updateConfirmation(async () => {
                //const results = await opn.status();
                
                return 'completed';
            });

        } catch (error: any) {
            console.log(`failed to mint ${error}`);
            setMint({ error });
        }
    }

    async function mintTz() {
        try {
            setMint({ isLoading: true });
            setConfirm(undefined);


            const { tezos } = await tzConnect();

            const tokenCtr = await tezos.wallet.at(TEST_TZ_TOKEN_ADDRESS);

            const opn = await tokenCtr.methods.giveMe().send();

            setMint({ result: `https://granadanet.tzkt.io/${opn?.opHash}` });

            updateConfirmation(async () => {
                const results = await opn.confirmation();
                //fldebugger;
                return 'completed';
            });

        } catch (error: any) {
            console.log(`failed to mint ${error}`);
            setMint({ error });
        }
    }

    return <Container className="text-center mx-auto pt-4">
        <h2 className="mb-5">Get your FREE test tokens</h2>

        <div>
            <p>Tezos Cross chain test token <a href="https://granadanet.tzkt.io/KT1Sxi4RdFmhuZFsJcpCk34e6Mv3otEjZ4Ag/operations/" target="_blank">KT1Sxi4RdFmhuZFsJcpCk34e6Mv3otEjZ4Ag</a></p>
            <p>EVM Cross chain test token <a href="https://ropsten.etherscan.io/token/0x4f3b397423a83f7db2fdbe7a98fd34f0ea2c748a" target="_blank">0x4f3b397423a83f7db2fdbe7a98fd34f0ea2c748a</a></p>
        </div>

        <div>

            {mint?.result && <Toast className="mx-auto my-4">
                <Toast.Header>
                    {/*<img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />*/}
                    <strong className="me-auto">Minted</strong>
                </Toast.Header>
                <Toast.Body>We minted <a target="_blank" href={mint.result} >10 tokens</a> for you</Toast.Body>
            </Toast>
            }

            {mint?.error && <ShowError error={mint.error} />}

            {mint?.isLoading && <div><Spinner animation="grow" variant="primary" /></div>}

            <div className="d-flex flex-column mt-5">
                <Button disabled={!!mint?.isLoading} variant="primary" onClick={async () => {
                    mintTz();
                }}>
                    Mint 10 Cross Chain test tokens on Granadanet (Tezos)
                </Button>

                <Button className="mt-5 px-4" disabled={!!mint?.isLoading} variant="info" onClick={async () => {
                    mintEvm();
                }}>
                    Mint 10 Cross Chain test tokens on Ropsten (ETH)
                </Button>
            </div>

        </div>

    </Container>;
}