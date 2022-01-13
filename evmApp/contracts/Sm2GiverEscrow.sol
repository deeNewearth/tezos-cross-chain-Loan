//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./Giverbase.sol";

/**
* @title tezoes-crosschain-loan SM2Bsc contract
*
* This contract Works represents SM2Bsc. refer to flow chart for it's functions
*
* Status values are -> 0 created, 1 -> returned, 2 -> released, 3 -> fortified, 4-> defaulted
*
*/

 contract Sm2GiverEscrow is GiverBase{


    modifier tokensTransferable(address _bscAssetContract, address _sender, uint256 _amount) {
        require(
            ERC20(_bscAssetContract).allowance(_sender, address(this)) >= _amount,
            "token allowance must be >= amount"
        );
        _;
    }

    /**
     * @dev STEP2: Called from Sm1GiverOriginator when Bob is funding the Loan
     *
     *
     * @param _contractId Id of the Loan.
     * @param _alexBscWallet bsc Wallet for Alex
     * @param _secret2Hash A sha-2 sha256 hash for secret1 created by Bob.
     * @param _bscAssetContract ERC20 Token contract address.
     * @param _bobsBscWallet bsc Wallet for Bob
     * @param _amount Amount of the tokens to lock up.
     * @return bool true on success
     */

    function setUpEscrow(
        bytes32 _contractId,

        address _bscAssetContract,
        uint256 _amount,
        
        //uint256 _lockedTill,
       // uint256 _releaseTill,
       LockDates calldata _lockDates,

        address _alexBscWallet,
        address _bobsBscWallet,

        bytes32 _secret2Hash
    )
        external
        tokensTransferable(_bscAssetContract, msg.sender, _amount)
        futureTimelock(_lockDates.lockedTill)
        

        returns (bool)
    {
        // Reject if a contract already exists with the same parameters. The
        // sender must change one of these parameters (ideally providing a
        // different _hashlock).
        if (haveContract(_contractId))
            revert("Contract already exists");

        contracts[_contractId] = LockedLoan(
            _secret2Hash, //secretHash
            _bscAssetContract,
            _amount,

            _bobsBscWallet, // bobsBscWallet :we don't know who will fund it yet
            _alexBscWallet, //alexBscWallet

            state_bobFunded, //status
            0x0, //preimage: no preimage relevaled yet

            0x0, //_reqTill,
            0x0, //_acceptTill,
            _lockDates.lockedTill,
            _lockDates.releaseTill
        );

        // This contract becomes the temporary owner of the bscAsset
        if (!ERC20(_bscAssetContract).transferFrom(msg.sender, address(this), _amount))
            revert("transferFrom sender to this failed");

        return true;
    }


    modifier returnTransferableAndCorrect(bytes32 _contractId, address _sender, uint256 _amount) {
        require(contracts[_contractId].status ==state_bobFunded, "loan state is not 'funded'");
        //require(block.timestamp < contracts[_contractId].validUntil, "loan duration has expired");
        require(_amount == contracts[_contractId].amount, "amount must be the loan amount");
        require(
            ERC20(contracts[_contractId].bscAssetContract).allowance(_sender, address(this)) >= _amount,
            "token allowance must be >= amount"
        );
        _;
    }



    /**
     * @dev STEP4: Alex returns the loaned assets
     *
     *
     * NOTE: Alex must first call approve() on the token contract.
     *       See allowance check in tokensTransferable modifier.
     *
     * @param _contractId Id of the Loan.
     * @param _amount Amount of the tokens to lock up.
     * @return bool true on success
     */

    function LoanComplete(
        bytes32 _contractId,
        uint256 _amount
    )
        external
        contractExists(_contractId)
        returnTransferableAndCorrect(_contractId, msg.sender, _amount)
        returns (bool)
    {
        LockedLoan storage c = contracts[_contractId];
        c.status = state_returned; 

        // This contract becomes the temporary owner of the bscAsset
        if (!ERC20(c.bscAssetContract).transferFrom(msg.sender, address(this), _amount))
            revert("transferFrom sender to this failed");

        emit TZLoanERC20Returned(
            _contractId
        );
        return true;
    }

    event TZLoanERC20Returned(
        bytes32 indexed contractId
    );


    modifier readyToDefault(bytes32 _contractId) {
        require(contracts[_contractId].status == state_bobFunded, "readyToRelease: states is not funcded");
        require(contracts[_contractId].lockedTill < block.timestamp, "readyToFortify: timelock not yet passed");
        _;
    }



    /**
    * @dev STEP4-1: Called by the Bob To get claim what's left loan has defaulted
    *
    * @param _contractId Id of the Load.
    * @param _preimage sha256(_preimage) should equal the contract hashlock.
    * @return bool true on success
     */
    function loanDefault(bytes32 _contractId, bytes32 _preimage)
        external
        contractExists(_contractId)
        hashlockMatches(_contractId, _preimage)
        readyToDefault(_contractId)
        returns (bool)
    {
        LockedLoan storage c = contracts[_contractId];
        c.preimage = _preimage;
        c.status = state_defaulted; //defaulted
        ERC20(c.bscAssetContract).transfer(c.bobsBscWallet, c.amount);
        
        return true;
    }

    modifier readyToRelease(bytes32 _contractId) {
        require(contracts[_contractId].bobsBscWallet == msg.sender, "readyToRelease: not loan giver");
        require(contracts[_contractId].status == state_returned, "readyToRelease: states is not returned");
        _;
    }

    /**
    * @dev STEP5: Called by the Bob To get claim security deposit
    *
    * @param _contractId Id of the Load.
    * @param _preimage sha256(_preimage) should equal the contract hashlock.
    * @return bool true on success
     */
    function releaseCollatoral(bytes32 _contractId, bytes32 _preimage)
        external
        contractExists(_contractId)
        hashlockMatches(_contractId, _preimage)
        readyToRelease(_contractId)
        returns (bool)
    {
        LockedLoan storage c = contracts[_contractId];
        c.preimage = _preimage;
        c.status = state_released; //released

        ERC20(c.bscAssetContract).transfer(c.bobsBscWallet, 2 * c.amount);
        emit TZLoanERC20Released(_contractId, _preimage);
        return true;
    }

    event TZLoanERC20Released(
        bytes32 indexed contractId,
        bytes32 preimage
    );

    modifier readyToFortify(bytes32 _contractId) {
        require(contracts[_contractId].releaseTill < block.timestamp, "readyToFortify: timelock not yet passed");
        require(contracts[_contractId].status == state_returned, "readyToFortify: states is not returned");
        _;
    }

    /**
    * @dev STEP5-f: Called by the ANYONE if Bob failed to claim security deposit in 1 day of release
    *
    * @param _contractId Id of the Load.
    * @return bool true on success
     */
    function fortify(bytes32 _contractId)
        external
        contractExists(_contractId)
        readyToFortify(_contractId)
        returns (bool)
    {
        LockedLoan storage c = contracts[_contractId];
        c.status = state_fortified; //fortified

        
        ERC20(c.bscAssetContract).transfer(c.alexBscWallet, 2 * c.amount);
        emit TZLoanERC20Fortified(_contractId);
        return true;
    }

    event TZLoanERC20Fortified(
        bytes32 indexed contractId
    );



 }
