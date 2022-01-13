//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract TestGTC is ERC20 {
    constructor() ERC20("cross chain 1.1", "chain-test-2")
    {
        //_mint(msg.sender, 1000 ether);
    }

    function giveMe() 
    external
    returns (bool)
    {
        _mint(msg.sender, 10 ether);
        return true;
    }
}
