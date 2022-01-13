import * as FaTypes from '../templates/FA1_2.contract';
import * as Types from './SubModule';

//const state_refundToBob:TNat =2;

@Contract
export class SMTaker extends Types.TgBase {

    //This is done before Step1 on the Taker Side, here we can ensure all Loan parameters are correct
    // STEP1 - Alex creates a loan Originator record with Secret 1
    // Alex would have to call approve before calling this
    @EntryPoint
    askForLoan(contractId:TBytes,
        secret1Hash: TBytes,
        secret1Store: TBytes,
        tzAssetContract: TAddress,
        amount: TNat,
        loanDuration: TInt,
        bobsTzWallet: TAddress,
        fees: TMutez,
        alexTzWallet: TAddress
     ): void {
        

        const req: Types.LoanReq={
            secret1Hash,
            tzAssetContract,
            amount,
            loanDuration,
            bobsTzWallet,
            fees,
            alexTzWallet,
            secret1Store
        }

        Sp.verify(req.alexTzWallet == Sp.sender, "caller is Not load requester");
        Sp.verify(req.fees == Sp.amount, "fees is not correct");


        //@ts-ignore
        const reqTill = Sp.now.addDays(1);
        //@ts-ignore
        const acceptTill = Sp.now.addDays(1);
        //@ts-ignore
        const lockedTill = Sp.now.addDays(req.loanDuration + 2);
        //@ts-ignore
        const releaseTill = Sp.now.addDays(req.loanDuration + 3);

        Sp.verify(req.loanDuration > 1, "loan duration must be at least 1 day");

        const newContract: Types.LockedLoan = {
            req,
            //alexTzWallet: Sp.sender,

            reqTill,
            acceptTill,
            lockedTill,
            releaseTill,

            status: this.state_created,
            preimage: "0x00",
            secret2Hash: "0x00",
            secret2Store: "0x00"
        };

        
        //Sp.verify(req.loanDuration == 0, "we got here");

        
        Sp.verify(!this.storage.contracts.hasKey(contractId), "contract already exists");

        this.storage.contracts.set(contractId, newContract);

        {
            //becomes temporary owner of the TzAsset
            //todo: verify allowance
            const c = Sp.contract<FaTypes.TransferParams>(newContract.req.tzAssetContract, "transfer").openSome();
            Sp.transfer({
                from: newContract.req.alexTzWallet,
                to: Sp.selfAddress,
                value: newContract.req.amount
            }, 0, c);

        }
        

        //Sp.transfer(contractId, 0, request.snd());

    }

    //STEP 2-1 : There were no takers for the Loan
    @EntryPoint
    refund(contractId: TBytes) {
        Sp.verify(this.storage.contracts.hasKey(contractId), "contract not found");

        const lc = this.storage.contracts.get(contractId);
        Sp.verify(lc.status == this.state_created, "refund: status is not 'created'");
        Sp.verify(lc.acceptTill > Sp.now, "refund timelock has not yet passed")

        //set status to refunded
        lc.status = this.state_refundToAlex;
        this.storage.contracts.set(contractId, lc);

        {
            const c1 = Sp.contract<FaTypes.TransferParams>(lc.req.tzAssetContract, "transfer").openSome();
            Sp.transfer({
                from: Sp.selfAddress,
                to: lc.req.alexTzWallet,
                value: lc.req.amount
            }
                , 0, c1);
        }

        {
            const c2 = Sp.contract<string>(lc.req.alexTzWallet).openSome();
            Sp.transfer("", lc.req.fees, c2);
        }

    }

    //STEP2: B4, Bob funds the loan and the security deposit and setup secret2
    //called by bob
    @EntryPoint
    setUpSecret2(contractId: TBytes, secret2Hash: TBytes, secret2Store: TBytes) {
        Sp.verify(this.storage.contracts.hasKey(contractId), "contractId not found");
        const lc = this.storage.contracts.get(contractId);

        Sp.verify(lc.req.bobsTzWallet == Sp.sender, "setUpSecret2: not the loan giver");

        Sp.verify(lc.status == this.state_created, "setUpSecret2: status is not 'created'");

        lc.secret2Hash = secret2Hash;
        lc.status = this.state_secret2Set;
        lc.secret2Store = secret2Store;

        this.storage.contracts.set(contractId, lc);
    }


    //STEP 3 : Alex has accepted the loan, move collatoral to escrow, preImage is for secret1
    @EntryPoint
    moveToEscrow(contractId: TBytes, preimage: TBytes) {
        Sp.verify(this.storage.contracts.hasKey(contractId), "contract not found");

        const lc = this.storage.contracts.get(contractId)
        Sp.verify(lc.status == this.state_secret2Set, "moveToEscrow: status is not 'state_secret2Set'");

        Sp.verify(lc.req.secret1Hash == Sp.sha3((preimage)), "hashlock hash does not match");

        //set status to movedToEscrow
        lc.status = this.state_movedToEscrow;
        lc.preimage = preimage;
        this.storage.contracts.set(contractId, lc);

        {
            const c3 = Sp.contract<void>(lc.req.bobsTzWallet).openSome();
            Sp.transfer(Sp.unit, lc.req.fees, c3);
        }

    }

    //STEP 4-1 :  Loan has defaulted. Called by ANYONE To wrap up the default
    @EntryPoint
    loanDefault(contractId: TBytes) {
        Sp.verify(this.storage.contracts.hasKey(contractId), "contractId not found");
        const lc = this.storage.contracts.get(contractId);

        Sp.verify(lc.status == this.state_movedToEscrow, "loanDefault: status is not 'movedToEscrow'");
        Sp.verify(lc.lockedTill <= Sp.now, "loanDefault: loan is not defaulted yet");

        //set status to defaulted
        lc.status = this.state_defaulted;
        this.storage.contracts.set(contractId, lc);

        {
            //transfer Asset to Bob
            const c = Sp.contract<FaTypes.TransferParams>(lc.req.tzAssetContract, "transfer").openSome();
            Sp.transfer({
                from: Sp.selfAddress,
                to: lc.req.bobsTzWallet,
                value: lc.req.amount
            }, 0, c);

        }
    }

    //STEP5: Loan has been returned, Bob has revelaed Secret 2 to claim security deposit
    @EntryPoint
    releaseCollatoral(contractId: TBytes, preimage: TBytes) {
        Sp.verify(this.storage.contracts.hasKey(contractId), "contractId not found");
        const lc = this.storage.contracts.get(contractId);

        Sp.verify(lc.status == this.state_movedToEscrow, "releaseCollatoral: status is not 'movedToEscrow'");

        Sp.verify(lc.secret2Hash == Sp.sha3((preimage)), "hashlock hash does not match");

        lc.status = this.state_released;
        lc.preimage = preimage;
        this.storage.contracts.set(contractId, lc);

        {
            //transfer Asset to Alex
            const c = Sp.contract<FaTypes.TransferParams>(lc.req.tzAssetContract, "transfer").openSome();
            Sp.transfer({
                from: Sp.selfAddress,
                to: lc.req.alexTzWallet,
                value: lc.req.amount
            }, 0, c);

        }

    }

}

//@Contract
class SimpleAsset {

    storage: {
        values: TMap<TAddress, {balance:TNat}>;
        
    } = {
        values: [],
    };
    
    @EntryPoint
    setBalance(address:TAddress, balance:TNat): void {
        this.storage.values.set(address,{balance});
    }

    @EntryPoint
    transfer(params: FaTypes.TransferParams): void {

        Sp.verify(this.storage.values.get(params.from).balance>=params.value,"out of money");
        this.storage.values.get(params.from).balance  = 
                this.storage.values.get(params.from).balance - params.value as TNat;
        this.storage.values.get(params.to).balance += params.value;
    }
    
}


Dev.test({ name: 'NormalFlow' }, () => {

    ​const alex = Scenario.testAccount("Alice");
    const ​bob  = Scenario.testAccount("Robert");

    const secret1: TBytes = "0x8787387387387387387373";
    const secret2: TBytes = "0x2020930939309309830983098";

    const tzAsset = Scenario.originate(new SimpleAsset(), { show: false });

    Scenario.h1('Originating Contract');
    const c = Scenario.originate(new SMTaker());

    Scenario.transfer(tzAsset.setBalance(alex.address,2200));
    Scenario.transfer(tzAsset.setBalance(bob.address,0));
    Scenario.transfer(tzAsset.setBalance(c.address,0));

    //Scenario.transfer

    const newContract:Types.LoanReq ={
        secret1Hash:Sp.sha3((secret1)),
        secret1Store:'8783873873873873873873873873873',
        tzAssetContract: tzAsset.address,
        amount:1200,
        loanDuration:30,
        bobsTzWallet:bob.address,
        fees:7,
        alexTzWallet:alex.address,
    }

    Scenario.h1('------ STEP1 alex ask for 1200 ----------');
    const contractId:TBytes = "98984875875875875875875875875875875";
    Scenario.transfer(c.askForLoan(
        contractId,
        newContract.secret1Hash,
        "98d98d98d98d98d8d8d98d98d98d98d98d",
        newContract.tzAssetContract,
        newContract.amount,
        newContract.loanDuration,
        newContract.bobsTzWallet,
        newContract.fees,
        newContract.alexTzWallet
        ), {
        sender: alex.address,
        amount:newContract.fees,
        
    });

    Scenario.show("alex balance = ") ;
    Scenario.show(tzAsset.storage.values.get(alex.address));
    Scenario.verify(1000==tzAsset.storage.values.get(alex.address).balance);
    Scenario.verify(1200==tzAsset.storage.values.get(c.address).balance);


    Scenario.h1('------ step2 bob give the loan and set up secret 2 ----------');
    Scenario.transfer(c.setUpSecret2(contractId,Sp.sha3(secret2),'76765656565656565656'), {
        sender: bob.address,
    });

    /*
    Scenario.h1('------ Step 2-1 Fail alex tries to get collatoral back ----------');
    Scenario.isFailing( Scenario.transfer(c.refund(contractId), {
        sender: bob.address,
    }));
    */

    Scenario.h1('------ step3 alex accepts the loan. secret1 is reveaed ----------');
    //server send this
    Scenario.transfer(c.moveToEscrow(contractId,secret1), {
    });

    Scenario.h1('------ step4 alex return the loan. secret2 is reveaed ----------');
    //server send this
    Scenario.transfer(c.releaseCollatoral(contractId,secret2), {
    });

    Scenario.show("alex balance = ") ;
    Scenario.show(tzAsset.storage.values.get(alex.address));
    Scenario.verify(2200==tzAsset.storage.values.get(alex.address).balance);
    
});


Dev.test({ name: 'check sha3' }, () => {
    ​const secret:TBytes ='61207175696b632062726f7720626f77';

    const k = Sp.sha3(secret);
    Scenario.show('secret is ');
    Scenario.show(k);


    ​

});

Dev.test({ name: 'Loan is not returned' }, () => {

    ​const alex = Scenario.testAccount("Alice");
    const ​bob  = Scenario.testAccount("Robert");

    const secret1: TBytes = "0x8787387387387387387373";
    const secret2: TBytes = "0x2020930939309309830983098";

    const tzAsset = Scenario.originate(new SimpleAsset(), { show: false });

    Scenario.h1('Originating Contract');
    const c = Scenario.originate(new SMTaker());

    Scenario.transfer(tzAsset.setBalance(alex.address,2200));
    Scenario.transfer(tzAsset.setBalance(bob.address,0));
    Scenario.transfer(tzAsset.setBalance(c.address,0));

    //Scenario.transfer

    const newContract:Types.LoanReq ={
        secret1Hash:Sp.sha3((secret1)),
        secret1Store:'98989898989898989898',
        tzAssetContract: tzAsset.address,
        amount:1200,
        loanDuration:30,
        bobsTzWallet:bob.address,
        fees:7,
        alexTzWallet:alex.address,
    }

    const startDate:TTimestamp = 10000;
    //@ts-ignore
    const pastDate =startDate.addDays(33);
    Scenario.show("pastDate = ") ;
    Scenario.show(pastDate);
    
    Scenario.h1('------ STEP1 alex ask for 1200 ----------');
    const contractId :TBytes="9898d98d98d98d98d98d98d"; 
    Scenario.transfer(c.askForLoan(
        contractId,
        newContract.secret1Hash,
        "9898989898989898989898",
        newContract.tzAssetContract,
        newContract.amount,
        newContract.loanDuration,
        newContract.bobsTzWallet,
        newContract.fees,
        newContract.alexTzWallet
        ), {
        sender: alex.address,
        amount:newContract.fees,
        
    });

    Scenario.show("alex balance = ") ;
    Scenario.show(tzAsset.storage.values.get(alex.address));
    Scenario.verify(1000==tzAsset.storage.values.get(alex.address).balance);
    Scenario.verify(1200==tzAsset.storage.values.get(c.address).balance);


    Scenario.h1('------ step2 bob give the loan and set up secret 2 ----------');
    Scenario.transfer(c.setUpSecret2(contractId,Sp.sha3((secret2)),'898989898989898989898'), {
        sender: bob.address,
        now:startDate
    });

    Scenario.h1('------ step3 alex accepts the loan. secret1 is reveaed ----------');
    //server send this
    Scenario.transfer(c.moveToEscrow(contractId,secret1), {
        now:startDate
    });

    Scenario.h1('------ step4-1 loan defaulted ----------');
    //server send this
    
    /*
    Scenario.p("--- fail before past date--")
    Scenario.isFailing( Scenario.transfer(c.loanDefault(contractId), {
        now:startDate
    }));
    */

    Scenario.p("--- fail after past date--")
    Scenario.transfer(c.loanDefault(contractId), {
        now:pastDate
    });

    Scenario.show("alex balance = ") ;
    Scenario.show(tzAsset.storage.values.get(alex.address));
    Scenario.show("bob balance = ") ;
    Scenario.show(tzAsset.storage.values.get(bob.address));

    Scenario.verify(1000==tzAsset.storage.values.get(alex.address).balance);
    Scenario.verify(1200==tzAsset.storage.values.get(bob.address).balance);
    
});


Dev.compileContract('SMTaker', new SMTaker());
