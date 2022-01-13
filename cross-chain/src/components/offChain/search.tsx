import { Fragment, useEffect, useState } from "react";

import { LoanMetaData, AssetContract } from "../svrProtocol";
import { IAsyncResult, CS_SERVER_URL, fetchJsonAsync, ShowError } from '../providers/utils';
import { Spinner, Row, Col, Container, Button, InputGroup, FormControl } from "react-bootstrap";
import { navigate } from '@patched/hookrouter';
import { loanhaStats } from '../svrProtocol';


export function AssetLine(p: AssetContract & { assetType: 'granadanet' | 'ropsten' }) {

    const url = 'granadanet' == p.assetType ?
        `https://granadanet.tzkt.io/${p.address}/operations/` :
        `https://ropsten.etherscan.io/token/${p.address}`
        ;

    return <span>
        <span>[{'granadanet' == p.assetType ? "Granadanet" : "Ropsten"}] </span>
        {/*p.description && <span> {p.description} - </span>*/}
        <a href={url} target="_blank">({p.symbol})</a>
    </span>;
}

export function AddressLine(p: { address: string, assetType: 'granadanet' | 'ropsten' }) {

    const url = 'granadanet' == p.assetType ?
        `https://granadanet.tzkt.io/${p.address}/operations/` :
        `https://ropsten.etherscan.io/token/${p.address}`
        ;

    const d = `${p.address.substring(0, 2)}...${p.address.substring(p.address.length - 5)}`;

    return <a href={url} target="_blank">{d}</a>;
}

export function LoanLine(l: LoanMetaData) {

    return <Fragment>
        <Col md="auto">
            <span className="text-muted">{l.submittedOn.toLocaleString()}</span>
            -- <i>user</i> <AddressLine address={l.alexTzWallet} assetType="granadanet" />
            <i> wants </i>
            <strong className="mx-3">{l.amount}</strong>
        </Col>

        <Col md="auto">
            <AssetLine assetType="ropsten" {...l.bscAssetContract} />
            <i> -- for -- </i>
            <AssetLine assetType="granadanet" {...l.tzAssetContract} />
        </Col>

        <Col md="auto">
            <i> -- for {l.loanDuration} days -- </i>
        </Col>

        <Col md="auto" >
            <i>-- fees offered -- Tz</i> {l.fees}
        </Col>

    </Fragment>;
}



export default function Search(props?: { newList?: LoanMetaData[] }) {

    const [loans, setLoans] = useState<IAsyncResult<LoanMetaData[]>>();

    useEffect(() => {
        if (loans?.result && props?.newList) {
            setLoans({ result: [...props.newList, ...loans.result] });
        }
    }, [props?.newList]);

    useEffect(() => {
        const load = async () => {
            try {
                setLoans({ isLoading: true });

                setLoans({ result: await fetchJsonAsync(fetch(`${CS_SERVER_URL}/api/loans`)) });

            } catch (error: any) {
                setLoans({ error });
            }

        };

        load();
    }, [])

    if (loans?.isLoading) {
        return <Spinner animation="grow" />;
    }

    if (loans?.error) {
        return <ShowError error={loans.error} />;
    }

    return <div className="text-center">
        <div className="d-flex">
            <h3 className="flex-grow-1 text-center"> <u>recent loans</u></h3>

            {/*<InputGroup className="mb-3">

                <FormControl
                    style={{maxWidth:'20rem'}}

                    onChange={e => {

                    }}
                />
                <Button size="sm" variant="outline-secondary" id="button-addon2">
                    Search
                </Button>
                </InputGroup>*/}

        </div>

        <div className="loanList">
            {loans?.result?.length ? <Container>
                {loans.result.map((l, i) => <Row key={l._id}
                    className={'py-2 justify-content-center ' + (i % 2 == 0 ? 'oddRow' : '')}>
                    <LoanLine {...{ ...l }} />
                    <Col md="auto">

                        {l.bobBscWallet ? <Button className="ml-4" size="sm"
                            variant="outline-secondary"
                            onClick={() => navigate(`/loan/${l._id}`)}
                        >
                            {loanhaStats(l?.status)?.status}
                        </Button> : <Button className="ml-4" size="sm"
                            variant="outline-success"
                            onClick={() => navigate(`/loan/${l._id}`)}
                        >
                            Trade
                        </Button>
                        }

                    </Col>

                </Row>
                )}
            </Container>
                : <div>No loans found</div>}

        </div>

    </div>;
}