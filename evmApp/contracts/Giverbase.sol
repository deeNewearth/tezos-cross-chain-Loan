//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "hardhat/console.sol";

contract GiverBase {

    struct LockDates {
        uint256 lockedTill;
        uint256 releaseTill;

    }

    struct LockedLoan {
        bytes32 secretHash;
        
        address bscAssetContract;
        uint256 amount;
        
        address bobsBscWallet;
        address alexBscWallet;
        
        uint8 status;
        bytes32 preimage;

        uint256 reqTill;
        uint256 acceptTill;

        uint256 lockedTill;
        uint256 releaseTill;
        
    }

    uint8 constant state_created =0;
    uint8 constant state_bobFunded =1;
    uint8 constant state_movedToEscrow =2;
    uint8 constant state_refundToBob =3;
    uint8 constant state_refundToAlex =4;
    uint8 constant state_returned =5;
    uint8 constant state_defaulted =6;
    uint8 constant state_released =7;
    uint8 constant state_fortified =8;


    mapping (bytes32 => LockedLoan) contracts;


    modifier contractExists(bytes32 _contractId) {
        require(haveContract(_contractId), "contractId does not exist");
        _;
    }


    modifier futureTimelock(uint256 _time) {
        // only requirement is the timelock time is after the last blocktime (now).
        // probably want something a bit further in the future then this.
        // but this is still a useful sanity check:
        require(_time > block.timestamp, "timelock time must be in the future");
        _;
    }

    modifier hashlockMatches(bytes32 _contractId, bytes32 _preImage) {
        require(
            contracts[_contractId].secretHash == keccak256(abi.encode(_preImage)),
            "hashlock hash does not match"
        );
        _;
    }

    /**
     * @dev Is there a contract with id _contractId.
     * @param _contractId Id into contracts mapping.
     */
    function haveContract(bytes32 _contractId)
        internal
        view
        returns (bool exists)
    {
        exists = (contracts[_contractId].alexBscWallet != address(0));
    }

    /**
     * @dev Get contract details.
     * @param _contractId HTLC contract id
     *
     */
    function getContract(bytes32 _contractId)
        public
        view
        returns (
            bytes32 secretHash,
            address bscAssetContract,
            uint256 amount,
            address bobsBscWallet,
            address alexBscWallet,
            uint8 status,
            bytes32 preimage,
            uint256 reqTill,
            uint256 acceptTill,
            uint256 lockedTill,
            uint256 releaseTill
        )
    {
        if (haveContract(_contractId) == false)
            return (0,address(0), 0, address(0), address(0),  0, 0, 0,   0, 0, 0);

        LockedLoan storage c = contracts[_contractId];
        return (
            c.secretHash,
            c.bscAssetContract,
            c.amount,
            c.bobsBscWallet,
            c.alexBscWallet,
            c.status,
            c.preimage,
            c.reqTill,
            c.acceptTill,
            c.lockedTill,
            c.releaseTill
        );
    }

}