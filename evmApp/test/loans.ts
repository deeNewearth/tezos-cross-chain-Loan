import { expect } from "chai";
import { ethers } from "hardhat";
import {Sm2GiverEscrowFactory} from '../generatedtypes/Sm2GiverEscrowFactory';
import {Sm1GiverOriginatorFactory} from '../generatedtypes/Sm1GiverOriginatorFactory';

describe("Loans", function () {
  it("CHECK sha HASH", async function () {
    const escrowFactory = await ethers.getContractFactory("Sm2GiverEscrow") as Sm2GiverEscrowFactory;
    const originatorFactory = await ethers.getContractFactory("Sm1GiverOriginator") as Sm1GiverOriginatorFactory;

    const escrow = await escrowFactory.deploy();
    await escrow.deployed();
    console.log("escrow deployed to:", escrow.address);
  
    const originator = await originatorFactory.deploy(escrow.address);
    await originator.deployed();
    console.log("originator deployed to:", originator.address);

    const packedId ="0xab642a6daea21bebaca4dd6c2a0cf8da810270aaa20003fc94bf8622ade6c259";

    const priImage = "0x61207175696b632062726f7720626f7700000000000000000000000000000000";

    //const h1 =await originator.testme("hello word");
    const h1 =await originator.testme(priImage);

    console.log(`we have sha : ${h1}`);

  });
});