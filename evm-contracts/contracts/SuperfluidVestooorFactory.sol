// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";

import {
    IConstantFlowAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import {
    ISuperfluid
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {
    ISuperToken,
    IERC20
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol";

import { SuperfluidVestooor } from "./SuperfluidVestooor.sol";

/// @title Superfluid Vesting Factory Contract
/// @author Superfluid
/// @notice A Contract Factory which creates vesting contract(s) for individual vestee(s).
contract SuperfluidVestooorFactory {
    struct Vestee {
        address vesteeAddress;
        uint256 amountToVest;
        uint256 vestingEndTimestamp;
    }

    /// @notice The address of the superfluid vesting contract
    address public immutable sfVestingImplementation;

    /// @notice The address of the SuperToken to be vested
    ISuperToken public immutable vestedToken;

    /// @notice The address of the ConstantFlowAgreementV1 contract
    IConstantFlowAgreementV1 public immutable cfa;

    /// @notice The address of the Host contract
    ISuperfluid public immutable host;

    /** Events */

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

    /** Custom Errors */

    error NO_ZERO_ADDRESS_VESTEE();
    error VESTING_END_TIME_TOO_EARLY();
    error ZERO_TOKENS_TO_VEST();

    constructor(
        address _sfVestingImplementation,
        ISuperToken _vestedToken,
        IConstantFlowAgreementV1 _cfa,
        ISuperfluid _host
    ) {
        sfVestingImplementation = _sfVestingImplementation;
        vestedToken = _vestedToken;
        cfa = _cfa;
        host = _host;
    }

    /// @notice Creates vesting contracts for multiple vestees.
    /// @dev The person sending this must properly approve and have enough balance sent to this
    /// @param _vestees A list of Vestee structs
    /// @param _totalAmountToBeVested The total amount of tokens to be vested to all vestees
    /// @return address[] a list of the deployed instance addresses
    function createVestingContracts(Vestee[] calldata _vestees, uint256 _totalAmountToBeVested)
        external
        returns (address[] memory)
    {
        if (_totalAmountToBeVested == 0 || _vestees.length == 0) revert ZERO_TOKENS_TO_VEST();

        address[] memory vestingContractAddresses = new address[](_vestees.length);
        _handleERC20TokenTransferAndUpgrade(msg.sender, _totalAmountToBeVested);
        for (uint256 i = 0; i < _vestees.length; ) {
            address vestingContractAddress = _createVestingContract(msg.sender, _vestees[i]);
            vestingContractAddresses[i] = vestingContractAddress;
            unchecked {
                ++i;
            }
        }
        return vestingContractAddresses;
    }

    /// @notice External function for creating the vesting contract
    /// @return address The address of the deployed clone instance
    function createVestingContract(Vestee calldata _vestee) external returns (address) {
        _handleERC20TokenTransferAndUpgrade(msg.sender, _vestee.amountToVest);
        return _createVestingContract(msg.sender, _vestee);
    }

    /// @notice Takes an ERC20 and transfer it from the "bank" to this contract
    /// @dev This also handles upgrading the token to a SuperToken for transferring to the vesting contract later
    /// @param _bank the source of funds
    /// @param _totalAmountToVest the total amount to be vested
    function _handleERC20TokenTransferAndUpgrade(address _bank, uint256 _totalAmountToVest)
        internal
    {
        address underlyingAddress = vestedToken.getUnderlyingToken();
        IERC20 token = IERC20(underlyingAddress);
        token.transferFrom(_bank, address(this), _totalAmountToVest);
        token.approve(address(vestedToken), _totalAmountToVest);
        vestedToken.upgrade(_totalAmountToVest);
    }

    /// @notice Creates a vesting contract
    /// @dev Creates a vesting contract using the Minimal Proxy Pattern (EIP-1167)
    /// @param _bank the address which will be transferring the tokens
    /// @param _vestee Vestee struct [vesteeAddress, amountToVest, vestingEndTimestamp, startVesting]
    /// @return address The address of the deployed clone instance
    function _createVestingContract(address _bank, Vestee calldata _vestee)
        internal
        returns (address)
    {
        if (_vestee.amountToVest == 0) revert ZERO_TOKENS_TO_VEST();
        if (_vestee.vesteeAddress == address(0)) revert NO_ZERO_ADDRESS_VESTEE();
        if (_vestee.vestingEndTimestamp < block.timestamp) revert VESTING_END_TIME_TOO_EARLY();

        address instanceAddress = Clones.clone(sfVestingImplementation);

        vestedToken.transfer(instanceAddress, _vestee.amountToVest);

        SuperfluidVestooor(instanceAddress).initialize(
            _vestee.vesteeAddress,
            host,
            cfa,
            vestedToken,
            _vestee.amountToVest,
            _vestee.vestingEndTimestamp
        );

        emit VestingContractCreated(
            vestedToken,
            instanceAddress,
            _vestee.vesteeAddress,
            _bank,
            _vestee.amountToVest,
            _vestee.vestingEndTimestamp
        );

        return instanceAddress;
    }
}
