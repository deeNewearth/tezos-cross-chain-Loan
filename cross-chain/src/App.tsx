
//import logo from './logo.svg';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import { useRoutes, navigate } from '@patched/hookrouter';

import {AddressLine} from './components/offChain/search';
import {BSC_CONTRACTS} from "./components/providers/web3Loader";
import { SM1_granadanet_address } from "./components/providers/tzTemple";

//import ManageTokens from './components/testToken/directTemple';
import ManageTokens from './components/testToken';

import { DAppProvider } from './components/providers/tzTemple';
import { EvmAppProvider } from './components/providers/web3Loader';

import { Nav } from 'react-bootstrap';

import NewLoan from './components/pages/loans';
/*
'/testtoken': () => <ManageTokens />,
  '/newLoan': () => <AskforLoan />,
  '/moveToescrow': () => <MoveToescrow />,
  '/giveloan': () => <GiveLoan />,
  '/releaseCollatoral': () => <ReleaseCollatoral />,
  '/getItback': () => <GetItBack />
  //'/products/:id': ({id}) => <ProductDetails id={id} />
*/

const routes = {
  '/': () => <NewLoan />,
  '/home': () => <NewLoan />,
  '/loan/:id': (props:any) => <NewLoan id={props.id} />,
  '/past': () => <ManageTokens />,
  '/testtoken': () => <ManageTokens />,

};

function App() {

  const routeResult = useRoutes(routes);

  if (!routeResult)
    return <div>Nothing here</div>;


  return (
    <div className="App">
      <header className="App-header">
        <h2 className="mx-2">Cross chain loans</h2>


        <Nav fill className="my-2" variant="tabs" defaultActiveKey="/home">
          <Nav.Item>
            <Nav.Link href="/home" onClick={e => {
              e.preventDefault();
              navigate('/home');
            }}>loans
            </Nav.Link>
          </Nav.Item>

          <Nav.Item>
            <Nav.Link href="/testtoken"  onClick={e => {
              e.preventDefault();
              navigate('/testtoken');
            }}>Get FREE Test tokens</Nav.Link>
          </Nav.Item>

          {/*
          <Nav.Item>
            <Nav.Link eventKey="link-1">Loooonger NavLink</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="link-2">Link</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="disabled" disabled>
              Disabled
            </Nav.Link>
          </Nav.Item>
          */}
        </Nav>
      </header>
      <DAppProvider appName="cross-chain"><EvmAppProvider>
        {routeResult}
      </EvmAppProvider></DAppProvider>

      <footer className="text-center text-muted">
        <hr/>
        <div>Our Smart contracts:</div>
        <div>Tezos cross-chain-loan : <AddressLine assetType="granadanet" address={SM1_granadanet_address}/> </div>
        <div>EVM loan-originator : <AddressLine assetType="ropsten" address={BSC_CONTRACTS.sm1Orginator}/> </div>
        <div>EVM loan- enscrow: <AddressLine assetType="ropsten" address={BSC_CONTRACTS.sm2Escrow}/> </div>
      </footer>



    </div>
  );
}

export default App;
