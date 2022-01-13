
export enum LoanRecordStatus {
    created, bobFunded, movedToEscrow, refundToBob,
    refundToAlex, returned, defaulted, released, fortified
}

export function loanhaStats(sStr?: LoanRecordStatus|string) {
    if (undefined == sStr)
        return {
            status: 'In progress',
        };

        let s:LoanRecordStatus;
        if (typeof sStr === 'string' ){
            s= Number.parseInt(sStr as string);
        }else{
            s = sStr;
        }

    switch (s) {
        case LoanRecordStatus.created:
            return { status: 'collatoral is ready' };
        case LoanRecordStatus.bobFunded:
            return { status: 'funds are ready' };
        case LoanRecordStatus.movedToEscrow:
            return { status: 'collatoral is in escrow' };
        case LoanRecordStatus.refundToBob:
            return { status: 'funds not picked up', defaulted: true };
        case LoanRecordStatus.refundToAlex:
            return { status: 'collatoral refunded' , defaulted: true };
        case LoanRecordStatus.returned:
            return { status: 'loan returned' };
        case LoanRecordStatus.defaulted:
            return { status: 'loan not returned' };
        case LoanRecordStatus.released:
            return { status: 'collatoral refunded', description:'This loan has been returned and  closed' };
        case LoanRecordStatus.fortified:
            return { status: 'collatoral not released',  defaulted: true};
        default:
            return {
                status: 'In progress',
            };  

    }
}

export type AssetContract = {
    symbol: string;
    description?: string;
    address: string;
}

export type LogsAndStatusUpdates = {
    log: string;
    status?: LoanRecordStatus;
}

export type TrLog = {
    at: Date;
    text: string;
}

export type fieldUpdate ={
    field:keyof LoanMetaData;
    data:any;
}

export type LoanMetaData = {

    _id?: any;

    submittedOn: Date;

    amount: number;

    loanDuration: number;
    fees: number;

    tzAssetContract: AssetContract
    bscAssetContract: AssetContract;

    alexBscWallet: string;
    alexTzWallet: string;

    bobBscWallet?: string;
    bobTzWallet?: string;

    status?: LoanRecordStatus;

    encryptedSecret1?: string;
    encryptedSecret2?: string;

    logs?: TrLog[];

};
