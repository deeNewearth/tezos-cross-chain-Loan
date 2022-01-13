const fs = require('fs');

function cpMy(contract){
    fs.copyFile(`../evmApp/artifacts/contracts/${contract}.sol/${contract}.json`, 
                `./src/generatedTypes/${contract}.json`, (err) => {
        if (err) 
            throw err;
        console.log(`${contract}.json copied`);
    });
}

cpMy('TestGTC');
cpMy('Sm1GiverOriginator');
cpMy('Sm2GiverEscrow');

