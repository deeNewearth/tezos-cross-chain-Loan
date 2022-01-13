import express from 'express';
//import {ecsign,toRpcSig,fromRpcSig,ecrecover,pubToAddress, sha256FromString} from 'ethereumjs-util';
//import * as util from "ethereumjs-util";

//import Web3 from 'web3';
//const web3 = new Web3();
import { MongoClient } from 'mongodb';
import cors from 'cors';
import {  LoanMetaData, LogsAndStatusUpdates, fieldUpdate } from '../../cross-chain/src/components/svrProtocol';
import { ObjectID } from 'bson';

import  path from 'path';

const app = express();


app.use(cors());
app.options("*", cors()); // include before other routes


const port = 3300;

/*
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", `http://mongodb:${port}`);
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
*/

app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

app.use(express.static('public'));
app.use('/docs',express.static('docs'));



app.listen(port, () => {
    console.log(`Running on port ${port}.`);
});

app.post('/api/update/:id', async (req, res) => {

    try {
        const client = await MongoClient.connect(`mongodb://mongodb:27017`);
        const loansCollection = client.db('loanDb').collection<LoanMetaData>('loans');

        const tr = req.body as fieldUpdate;

        const theUpdate:any ={};
        theUpdate[tr.field] = tr.data;

        const _id = ObjectID.createFromHexString(req.params.id);

        {
            await loansCollection.updateOne({_id},
                {
                    $set:theUpdate,
                }
            );
        }

        return res.json(theUpdate);

    }
    catch (err) {
        console.log(`check failed , err = ${err}`);
        res.sendStatus(500).json({message:err.toString()});
    }

});



app.post('/api/logs/:id', async (req, res) => {

    try {
        const client = await MongoClient.connect(`mongodb://mongodb:27017`);
        const loansCollection = client.db('loanDb').collection<LoanMetaData>('loans');

        const trLogStatus = req.body as LogsAndStatusUpdates;

        const _id = ObjectID.createFromHexString(req.params.id);

        if(trLogStatus.log ){
            await loansCollection.updateOne({_id},
                {
                    $push:{logs:{
                        text:trLogStatus.log,
                        at:new Date()
                    }},
                }
            );
        }

        if(undefined != trLogStatus.status){
            await loansCollection.updateOne({_id},
                {
                    $set:{status:trLogStatus.status}
                }
            );
        }


        const allLogs = (await loansCollection.findOne({_id})).logs;

        return res.json(allLogs);

    }
    catch (err) {
        console.log(`check failed , err = ${err}`);
        res.sendStatus(500).json({message:err.toString()});
    }

});


app.post('/api/loans', async (req, res) => {

    try {
        const client = await MongoClient.connect(`mongodb://mongodb:27017`);
        const loansCollection = client.db('loanDb').collection<LoanMetaData>('loans');

        const loan = req.body as LoanMetaData;

        if(!loan._id){
            const done = await loansCollection.insertOne(loan );
        }else{

            const _id = ObjectID.createFromHexString(loan._id);
            loan._id = _id;

            const done = await loansCollection.replaceOne({_id}, loan );
        }

        return res.json(loan);


    }
    catch (err) {
        console.log(`check failed , err = ${err}`);
        res.sendStatus(500).json({message:err.toString()});
    }

});

app.get('/api/loans/:id', async (req, res) => {

    try {

        const client = await MongoClient.connect(`mongodb://mongodb:27017`);
        const loans = client.db('loanDb').collection('loans');

        const _id = ObjectID.createFromHexString(req.params.id);

        const ret = await loans.findOne({_id});


        if(!ret){
            res.sendStatus(404).json({message:'not found'});
            return;
        }

        return res.json(ret);

    }
    catch (err) {
        console.log(`check failed , err = ${err}`);
        res.sendStatus(500).json({message:err.toString()});
    }

});

app.get('/api/loans', async (req, res) => {

    try {

        
        const client = await MongoClient.connect(`mongodb://mongodb:27017`);
        const loans = client.db('loanDb').collection('loans');

        const ret = await loans.find().sort({submittedOn:-1}) .toArray();

        return res.json(ret);

    }
    catch (err) {
        console.log(`check failed , err = ${err}`);
        res.sendStatus(500).json({message:err.toString()});
    }

});

app.get('/api/test', async (req, res) => {

    try {

        res.json({ address: 123 });
    }
    catch (err) {
        console.log(`check failed , err = ${err}`);
        res.sendStatus(500).send(err.toString());
    }

});

// All other GET requests not handled before will return our React app
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '/server/public', 'index.html'));
});