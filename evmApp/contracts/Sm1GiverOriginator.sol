//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./Giverbase.sol";
import "./Sm2GiverEscrow.sol";

/**
 * @title tezoes-crosschain-loan SM1Bsc contract
 *
 * This contract Works represents SM1Bsc. refer to flow chart for it's functions
 * Influneced by
 * https://github.com/chatch/hashed-timelock-contract-ethereum/blob/master/contracts/HashedTimelockERC20.sol
 * https://github.com/bonesoul/zeppelin-solidity/blob/master/contracts/token/TokenTimelock.sol
 * https://github.com/chatch/hashed-timelock-contract-ethereum/blob/master/contracts/HashedTimelock.sol
 *
 *
 *  Status values are -> 0 created, 1 funded, 2 accepted, 3 refunded
 *
 */

contract Sm1GiverOriginator is GiverBase {
    address sm2GiverEscrowContract;

    /**
     * @dev deploys the SM1 contract in BSC
     *
     * @param _sm2GiverEscrowContract address of SM2Bsc
     */
    constructor(address _sm2GiverEscrowContract) {
        sm2GiverEscrowContract = _sm2GiverEscrowContract;
    }

    /**
     * @dev STEP 1 - Alex creates a loan Originator record with Secret 1
     *
     *
     * @param _contractId the external Id of the contract
     * @param _bscAssetContract ERC20 Token contract address.
     * @param _amount loan amount.
     * @param _secret1Hash A sha3 hash for secret1 created by Alex.
     *
     */
    function askForLoan(
        bytes32 _contractId,

        address _bscAssetContract,
        uint256 _amount,
        bytes32 _secret1Hash,

        uint256 _reqTill,
        uint256 _acceptTill,
        uint256 _lockedTill,
        uint256 _releaseTill
    )
        external
        futureTimelock(_reqTill)
        futureTimelock(_acceptTill)
        futureTimelock(_lockedTill)
        futureTimelock(_releaseTill)
    {
        require(_amount > 0, "token amount must be > 0");

        // Reject if a contract already exists with the same parameters. The
        // sender must change one of these parameters (ideally providing a
        // different _hashlock).
        if (haveContract(_contractId)) revert("Contract already exists");

        contracts[_contractId] = LockedLoan(
            _secret1Hash, //secretHash
            _bscAssetContract,
            _amount,

            address(0), // bobsBscWallet :we don't know who will fund it yet
            msg.sender, //alexBscWallet

            state_created, //status
            0x0, //preimage: no preimage relevaled yet

            _reqTill,
            _acceptTill,
            _lockedTill,
            _releaseTill
        );

        emit TZLoanERC20New(
            _contractId,
            msg.sender,
            _reqTill,
            _bscAssetContract,
            _amount
        );
    }

    event TZLoanERC20New(
        bytes32 indexed contractId,
        address indexed alexBscWallet,
        uint256 validUntil,
        address indexed bscAssetContract,
        uint256 amount
    );

    modifier tokensTransferableAndCorrect(
        bytes32 _contractId,
        address _sender,
        uint256 _amount
    ) {
        require(
            contracts[_contractId].status == state_created,
            "loan state is not 'created'"
        );
        require(
            block.timestamp < contracts[_contractId].reqTill,
            "loan request has expired"
        );

        /* not sure we need to test this
        uint value = _amount / 2;
        if ((2 * value) != _amount)
        */

        require(
            _amount == (2 * contracts[_contractId].amount),
            "amount must be twice the loan amount"
        );
        require(
            ERC20(contracts[_contractId].bscAssetContract).allowance(
                _sender,
                address(this)
            ) >= _amount,
            "token allowance must be >= twice loan amount"
        );
        _;
    }

    /**
     * @dev STEP2: Bob funds the loan and the security deposit
     *
     *
     * NOTE: bob must first call approve() on the token contract.
     *       See allowance check in tokensTransferable modifier.
     *
     * @param _contractId Id of the Loan.
     * @param _amount Amount of the tokens to lock up.
     * @param _secret2Hash A sha-2 sha256 hash for secret1 created by Bob.
     * @return bool true on success
     */

    function giveLoan(
        bytes32 _contractId,
        uint256 _amount,
        bytes32 _secret2Hash
    )
        external
        contractExists(_contractId)
        tokensTransferableAndCorrect(_contractId, msg.sender, _amount)
        returns (bool)
    {
        LockedLoan storage c = contracts[_contractId];
        c.status = state_bobFunded;
        c.bobsBscWallet = msg.sender;

        // This contract becomes the temporary owner of the bscAsset
        if (
            !ERC20(c.bscAssetContract).transferFrom(
                msg.sender,
                address(this),
                _amount
            )
        ) revert("transferFrom sender to this failed");

        //ERC20(c.bscAssetContract).transfer(sm2GiverEscrowContract,c.amount);
        ERC20(c.bscAssetContract).approve(sm2GiverEscrowContract, c.amount);

        Sm2GiverEscrow(sm2GiverEscrowContract).setUpEscrow(
            _contractId,

            c.bscAssetContract,
            c.amount,

            //c.lockedTill,
            //c.releaseTill,
            LockDates(c.lockedTill,c.releaseTill),

            c.alexBscWallet,
            c.bobsBscWallet,

            _secret2Hash
           
        );

        emit TZLoanERC20Funded(_contractId, msg.sender);
        return true;
    }

    event TZLoanERC20Funded(
        bytes32 indexed contractId,
        address indexed bobsBscWallet
    );

    modifier readyToAccept(bytes32 _contractId) {
        require(
            contracts[_contractId].alexBscWallet == msg.sender,
            "readyToAccept: not loan requester"
        );
        require(
            contracts[_contractId].status == state_bobFunded,
            "readyToAccept: states not equals funded"
        );
        _;
    }

    /**
     * @dev STEP3: Called by the Alex To get the loan funds.
     *
     * @param _contractId Id of the Load.
     * @param _preimage sha256(_preimage) should equal the contract hashlock.
     * @return bool true on success
     */
    function acceptLoan(bytes32 _contractId, bytes32 _preimage)
        external
        contractExists(_contractId)
        hashlockMatches(_contractId, _preimage)
        readyToAccept(_contractId)
        returns (bool)
    {
        LockedLoan storage c = contracts[_contractId];
        c.preimage = _preimage;
        c.status = state_movedToEscrow; //accepted

        ERC20(c.bscAssetContract).transfer(c.alexBscWallet, c.amount);
        emit TZLoanERC20Accepted(_contractId, _preimage);
        return true;
    }

    event TZLoanERC20Accepted(bytes32 indexed contractId, bytes32 preimage);

    modifier refundable(bytes32 _contractId) {
        require(
            contracts[_contractId].status == state_bobFunded,
            "refundable: status is not `funded`"
        );
        require(
            contracts[_contractId].acceptTill < block.timestamp,
            "refundable: timelock not yet passed"
        );
        _;
    }

    /**
     * @dev STEP 2-f1 Called by ANYONE if there was no Loan Accept AND the time lock has
     * expired. This will restore ownership of the bscAssets to the bob.
     *
     * @param _contractId Id of Loan
     * @return bool true on success
     */
    function refund(bytes32 _contractId)
        external
        contractExists(_contractId)
        refundable(_contractId)
        returns (bool)
    {
        LockedLoan storage c = contracts[_contractId];
        c.status = state_refundToBob; //refunded
        ERC20(c.bobsBscWallet).transfer(c.bobsBscWallet, c.amount);
        emit TZLoanERC20Refund(_contractId);
        return true;
    }

    event TZLoanERC20Refund(bytes32 indexed contractId);

    
}
