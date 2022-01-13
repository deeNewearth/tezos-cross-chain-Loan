import { Button } from "react-bootstrap";
import { TempleWallet } from "@temple-wallet/dapp";

export default function ManageTestToken() {

    return <div>
        <h2>Manage test tokens 111</h2>

        <Button variant="primary" onClick={async () => {
            try {
                debugger;

                const available = await TempleWallet.isAvailable();
                if (!available) {
                  throw new Error("Temple Wallet not installed");
                }
            
                // Note:
            
                // use `TempleWallet.isAvailable` method only after web application fully loaded.
            
                // Alternatively, you can use the method `TempleWallet.onAvailabilityChange`
                // that tracks availability in real-time .
            
                const wallet = new TempleWallet("My Super DApp");
                await wallet.connect("granadanet");
                const tezos = wallet.toTezos();
            
                const accountPkh = await tezos.wallet.pkh();
                const accountBalance = await tezos.tz.getBalance(accountPkh);
                console.info(`address: ${accountPkh}, balance: ${accountBalance}`);
            
                const counter = await tezos.wallet.at(
                  "KT1JNrJTfr5X9o1LpBn2PNvMPYk4g6guV9ig"
                );
            
                const operation = await counter.methods.mint('tz1bLBkLUWcnQbCC8pCcjtwZvekLUwPPEsRq',100).send();
                await operation.confirmation();
            
                const counterValue = await counter.storage();
                console.info(`count: ${counterValue}`);


            } catch (err: any) {
                console.log(err);
                debugger;
            }
        }}>
            Mint 100 tokens
        </Button>

    </div>;
}