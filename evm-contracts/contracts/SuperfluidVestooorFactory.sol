// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import {
    IConstantFlowAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import {
    ISuperfluid
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {
    ISuperToken
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol";

import { SuperfluidVestooor } from "./SuperfluidVestooor.sol";

/// @title Superfluid Vesting Factory Contract
/// @author Superfluid
/// @notice A Contract Factory which creates vesting contract(s) for individual vestee(s).
contract SuperfluidVestooorFactory is Ownable {
    struct Vestee {
        address vesteeAddress;
        uint256 amountToVest;
        uint256 vestingEndTimestamp;
    }

    /// @notice The address of the superfluid vesting contract
    address public sfVestingImplementation;

    /// @notice VestingContractCreated Event
    /// @dev This event is emitted whenever a Vestooor Contract is created
    /// @param vestedToken the token to be vested
    /// @param instanceAddress the address of the new vesting instance
    /// @param bank the origin of the vested tokens
    /// @param amountToVest the amount of tokens to be vested
    /// @param vestingEndTimestamp the timestamp the balance of the vested token will be 0
    event VestingContractCreated(
        ISuperToken vestedToken,
        address instanceAddress,
        address vestee,
        address bank,
        uint256 amountToVest,
        uint256 vestingEndTimestamp
    );

    constructor(address _sfVestingImplementation) {
        sfVestingImplementation = _sfVestingImplementation;
    }

    /// @notice Creates vesting contracts for multiple vestees.
    /// @dev The person sending this must properly approve and have enough balance sent to this
    /// @param _vestees A list of Vestee structs
    /// @param _vestedToken The SuperToken to vest
    /// @param _host Superfluid Host contract address
    /// @param _cfa Superfluid CFA contract address
    function createVestingContracts(
        Vestee[] calldata _vestees,
        ISuperToken _vestedToken,
        ISuperfluid _host,
        IConstantFlowAgreementV1 _cfa
    ) external onlyOwner returns (address[] memory) {
        address[] memory vestingContractAddresses = new address[](_vestees.length);
        for (uint256 i; i < _vestees.length; ++i) {
            address vestingContractAddress = _createVestingContract(
                msg.sender,
                _vestees[i],
                _host,
                _cfa,
                _vestedToken
            );
            vestingContractAddresses[i] = vestingContractAddress;
        }
        return vestingContractAddresses;
    }

    /// @notice External function for creating the vesting contract
    function createVestingContract(
        Vestee calldata _vestee,
        ISuperfluid _host,
        IConstantFlowAgreementV1 _cfa,
        ISuperToken _vestedToken
    ) external onlyOwner returns (address) {
        return _createVestingContract(msg.sender, _vestee, _host, _cfa, _vestedToken);
    }

    /// @notice Creates a vesting contract
    /// @dev Creates a vesting contract using the Minimal Proxy Pattern (EIP-1167)
    /// @param _bank the address which will be transferring the tokens
    /// @param _vestee Vestee struct [vesteeAddress, amountToVest, vestingEndTimestamp, startVesting]
    /// @param _host the host contract address
    /// @param _cfa the cfa contract address
    function _createVestingContract(
        address _bank,
        Vestee calldata _vestee,
        ISuperfluid _host,
        IConstantFlowAgreementV1 _cfa,
        ISuperToken _vestedToken
    ) internal returns (address) {
        address instanceAddress = Clones.clone(sfVestingImplementation);

        _vestedToken.transferFrom(_bank, instanceAddress, _vestee.amountToVest);

        SuperfluidVestooor(instanceAddress).initialize(
            _vestee.vesteeAddress,
            _host,
            _cfa,
            _vestedToken,
            _vestee.amountToVest,
            _vestee.vestingEndTimestamp
        );

        emit VestingContractCreated(
            _vestedToken,
            instanceAddress,
            _vestee.vesteeAddress,
            _bank,
            _vestee.amountToVest,
            _vestee.vestingEndTimestamp
        );

        return instanceAddress;
    }
}
