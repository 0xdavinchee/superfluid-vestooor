// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

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

import { SuperfluidVestooorFactory } from "./SuperfluidVestooorFactory.sol";

/// @title SuperfluidVestooorFactoryCreator contract
/// @author Superfluid
/// @notice This contract creates SuperfluidVestoooorFactory contracts
/// @dev This contract uses create2 to deterministically create factory contracts
contract SuperfluidVestooorFactoryCreator {
    /// @notice The Vestooor contract implementation address
    /// @dev This is immutable and declared in initialization
    address public immutable vestingImplementation;

    /// @notice ConstantFlowAgreementV1 contract address
    /// @dev Will vary depending on the chain
    IConstantFlowAgreementV1 public immutable cfaV1;

    /// @notice Superfluid host contract address
    /// @dev Will vary depending on the chain
    ISuperfluid public immutable host;

    constructor(
        address _vestingImplementation,
        ISuperfluid _host,
        IConstantFlowAgreementV1 _cfav1
    ) {
        vestingImplementation = _vestingImplementation;
        host = _host;
        cfaV1 = _cfav1;
    }

    event FactoryCreated(address indexed deployedContract, address indexed token);

    /// @notice Creates a SuperfluidVestooorFactory contract deterministically
    /// @dev This function uses create2 to deterministically create addresses, the token is the salt
    /// @param _token the super token that the SuperfluidVestooorFactory will create vesting contracts for
    /// @return addr deterministically created address
    function createFactory(ISuperToken _token) external payable returns (address addr) {
        bytes32 salt = keccak256(abi.encode(_token));
        return
            address(
                new SuperfluidVestooorFactory{ salt: salt }(
                    vestingImplementation,
                    _token,
                    cfaV1,
                    host
                )
            );
    }

    /// @notice Computes the address of the deterministically created SuperfluidVestooorFactory contract
    /// @dev https://solidity-by-example.org/app/create2/
    /// @param _token the super token of the SuperfluidVestooorFactory contract
    /// @return The computed SuperfluidVestooor factory address created from this factory creator
    function computeAddress(ISuperToken _token) public view returns (address) {
        // NOTE: cast last 20 bytes of hash to address
        bytes32 bytecode = _getHashedBytecode(_token);
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                keccak256(abi.encode(_token)),
                                bytecode
                            )
                        )
                    )
                )
            );
    }

    function _getHashedBytecode(ISuperToken _token) internal view returns (bytes32) {
        bytes memory bytecode = type(SuperfluidVestooorFactory).creationCode;

        return
            keccak256(
                abi.encodePacked(bytecode, abi.encode(vestingImplementation, _token, cfaV1, host))
            );
    }
}
