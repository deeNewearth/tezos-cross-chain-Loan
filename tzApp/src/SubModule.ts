export type LoanReq = {
    secret1Hash: TBytes,
    
    tzAssetContract: TAddress,
    amount: TNat,
    loanDuration: TInt,
    bobsTzWallet: TAddress,
    fees: TMutez,
    alexTzWallet: TAddress,

    secret1Store: TBytes;
}



export type LockedLoan = {
    req: LoanReq,

    status: TNat,   //uses one of the const state_

    preimage: TBytes,

    //The differenet Time Locks, see DateLock flow doc
    reqTill:TTimestamp, //T1
    acceptTill:TTimestamp, //T2
    lockedTill:TTimestamp, //T3
    releaseTill:TTimestamp, //T4
    secret2Hash: TBytes,

    secret2Store: TBytes;

};

export interface TStorage {
    value: TNat;
    contracts: TMap<TBytes, TRecord<LockedLoan>>;
    sm2TakerEscrowContract: TString;
    
}

export type LockedInLoan ={
    contractId: TBytes;
    newContract: LockedLoan;
}


export class TgBase{

    state_created =0;
    state_secret2Set =1;
    state_movedToEscrow =2;
    state_refundToBob =3;
    state_refundToAlex =4;
    state_returned =5;
    state_defaulted =6;
    state_released =7;

    storage: {
        contracts: TMap<TBytes, TRecord<LockedLoan>>;
        
    } = {
        contracts: [],
        
    };


}
