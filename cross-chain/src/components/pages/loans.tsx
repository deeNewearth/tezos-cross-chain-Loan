import { useState, useEffect } from 'react';
import { LoanMetaData } from '../svrProtocol';
import NewLoan from '../offChain/newLoan';
import Search, { LoanLine } from '../offChain/search';

import { IAsyncResult, CS_SERVER_URL, fetchJsonAsync, ShowError } from '../providers/utils';
import { Spinner, Container, Alert } from 'react-bootstrap';
import { LoanRecordStatus } from '../svrProtocol';

import BobAgrees from '../bobSteps/agreesToFund';
import AlexSetsUpLoan from '../alexSteps/askForLoan';
import BobDeposisFunds from '../bobSteps/giveLoan';
import AlexPicksUpFunds from '../alexSteps/acceptLoan';
import AlexReturnsTheLoan from '../alexSteps/getItback';
import BobReleasesCollatoral from '../bobSteps/releaseCollatoral';

import { loanhaStats, LogsAndStatusUpdates, TrLog } from '../svrProtocol';


export default function Loans(props?: { id?: string }) {
    const [newLoans, setNewLoans] = useState<LoanMetaData[]>([]);

    const [loan, setLoan] = useState<IAsyncResult<LoanMetaData>>();

    async function loadLoan(id: string | undefined) {
        if (!id) {
            setLoan(undefined);
            return;
        }

        try {
            setLoan({ isLoading: true });

            setLoan({ result: await fetchJsonAsync(fetch(`${CS_SERVER_URL}/api/loans/${id}`)) });

        } catch (error: any) {
            setLoan({ error });
        }
    }

    useEffect(() => {
        loadLoan(props?.id);
    }, [props?.id]);

    async function updateLoanStatus(id: string, log: string, status?: LoanRecordStatus) {

        const toSend: LogsAndStatusUpdates = {
            log,
            status
        }

        const logs = await fetchJsonAsync<TrLog[]>(fetch(`${CS_SERVER_URL}/api/logs/${id}`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(toSend)
        }));

        if (loan?.result) {
            setLoan({ result: { ...loan.result, logs: logs.reverse() } })
        }

    }


    function ShowLoan() {
        if (!loan) {
            return <NewLoan onNew={l => setNewLoans([l, ...newLoans])} />;
        }

        if (loan?.isLoading) {
            return <Spinner animation="grow" />;
        }

        if (loan?.result && undefined == loan?.result?.status) {
            //we are off still offchain
            if (!loan?.result.bobBscWallet) {
                return <BobAgrees {...{ updateLoanStatus }} loan={loan.result} onUpdate={() => loadLoan(loan.result?._id)} />;
            }

            //else it's time for Alex to accept the loan

            return <AlexSetsUpLoan {...{ updateLoanStatus }} loan={loan.result} onUpdate={() => loadLoan(loan.result?._id)} />;

        }

        let s: LoanRecordStatus | undefined;
        if (typeof loan.result?.status === 'string') {
            s = Number.parseInt(loan.result.status as string);
        } else {
            s = loan.result?.status;
        }

        if (!loan.result) {
            return <div>Unknown status</div>;
        }

        switch (s) {
            case LoanRecordStatus.created:
                return <BobDeposisFunds {...{ updateLoanStatus }} loan={loan.result} onUpdate={() => loadLoan(loan.result?._id)} />;
            case LoanRecordStatus.bobFunded:
                return <AlexPicksUpFunds {...{ updateLoanStatus }} loan={loan.result} onUpdate={() => loadLoan(loan.result?._id)} />;
            case LoanRecordStatus.movedToEscrow:
                return <AlexReturnsTheLoan {...{ updateLoanStatus }} loan={loan.result} onUpdate={() => loadLoan(loan.result?._id)} />;
            case LoanRecordStatus.returned:
                return <BobReleasesCollatoral {...{ updateLoanStatus }} loan={loan.result} onUpdate={() => loadLoan(loan.result?._id)} />;


            case LoanRecordStatus.refundToBob:
            case LoanRecordStatus.refundToAlex:
            case LoanRecordStatus.defaulted:
            case LoanRecordStatus.released:
            case LoanRecordStatus.fortified:
            default:
                const st = loanhaStats(loan.result.status);
                return <Container className="text-center">

                    <Alert variant="success">


                        <h4 className="text-success m-4">
                            <span> {st.description || ` This loan is ${st.status}`}</span>
                        </h4>

                        <div className="justify-content-center">
                            <LoanLine {...loan.result} />
                        </div>



                    </Alert>

                </Container>;

        }

    }

    return <div className="text-center">
        {loan?.error && <ShowError error={loan.error} />}
        <ShowLoan />

        <ul className="logList">
            {(loan?.result?.logs || []).map((l, i) => <li key={i}>
                {l.at.toLocaleString()} -- {l.text}
            </li>)}
        </ul>

        <hr />
        <Search newList={newLoans} />
    </div>;

}