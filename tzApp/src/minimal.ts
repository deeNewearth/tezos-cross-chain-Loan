

export interface TStorage {
    value: TNat;
    sm2TakerEscrowContract: TString;
}

@Contract
export class Minimal {
    storage : TStorage = {
        value: 1,
        //contracts: [],
        sm2TakerEscrowContract : ""
    };

    
    @EntryPoint
    setEscrowContract(value: TString): void {
        this.storage.sm2TakerEscrowContract = value;
    }
    

    @EntryPoint
    ep(value: TNat): void {
        this.storage.value = value;
    }
}


@Contract
export class Maximal {
    storage : TStorage = {
        value: 1,
        //contracts: [],
        sm2TakerEscrowContract : ""
    };

    
    @EntryPoint
    setEscrowContract(value: TString): void {
        this.storage.sm2TakerEscrowContract = value;
    }
    

    @EntryPoint
    ep(value: TNat): void {
        this.storage.value = value;
    }
}
