//import * as Types from './SubModule';
import * as MinTypes from './minimal';



@Contract
export class Minimal1 extends MinTypes.Minimal {
   
}

@Contract
export class Maximal1 extends MinTypes.Maximal {
   
}

Dev.test({ name: 'Minimal' }, () => {
    Scenario.h1('Originating Contract');
    const c1 = Scenario.originate(new Minimal1());
    Scenario.show('test me 356');
    //const c2 = Scenario.originate(new Maximal1());
    Scenario.show('test me 35');

    Scenario.p('Initial value must be 1.');
    Scenario.verify(c1.storage.value == 1);
    //Scenario.verify(c2.storage.value == 1);

    Scenario.h2('Calling entry point (ep) with value 10.');
    Scenario.transfer(c1.ep(10));

    Scenario.p('Final value must be 10.');
    Scenario.verify(c1.storage.value == 10);

    
});

Dev.compileContract('minimal', new Minimal1());
Dev.compileContract('maximal', new Maximal1());

