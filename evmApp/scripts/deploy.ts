// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

import {Sm2GiverEscrowFactory} from '../generatedtypes/Sm2GiverEscrowFactory';
import {Sm1GiverOriginatorFactory} from '../generatedtypes/Sm1GiverOriginatorFactory';

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const escrowFactory = await ethers.getContractFactory("Sm2GiverEscrow") as Sm2GiverEscrowFactory;
  const originatorFactory = await ethers.getContractFactory("Sm1GiverOriginator") as Sm1GiverOriginatorFactory;

  const escrow = await escrowFactory.deploy();
  await escrow.deployed();
  console.log("escrow deployed to:", escrow.address);

  const originator = await originatorFactory.deploy(escrow.address);
  await originator.deployed();
  console.log("originator deployed to:", originator.address);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
