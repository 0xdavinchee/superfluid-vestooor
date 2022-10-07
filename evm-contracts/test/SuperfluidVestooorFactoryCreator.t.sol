// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {
    SuperfluidFrameworkDeployer
} from "@superfluid-finance/ethereum-contracts/contracts/utils/SuperfluidFrameworkDeployer.sol";
import {
    IConstantFlowAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import {
    ISuperfluid
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {
    ISuperToken
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol";

import { SuperfluidVestooor } from "../contracts/SuperfluidVestooor.sol";
import {
    SuperfluidVestooorFactoryCreator
} from "../contracts/SuperfluidVestooorFactoryCreator.sol";

import "forge-std/Test.sol";

contract SuperfluidVestooorFactoryCreatorTest is Test {
    SuperfluidVestooorFactoryCreator public factoryCreator;
    SuperfluidFrameworkDeployer public deployer;

    // ISuperToken public token;

    function setUp() public {
        deployer = new SuperfluidFrameworkDeployer();
        SuperfluidFrameworkDeployer.Framework memory framework = deployer.getFramework();
        SuperfluidVestooor vestooor = new SuperfluidVestooor();

        factoryCreator = new SuperfluidVestooorFactoryCreator(
            address(vestooor),
            framework.host,
            framework.cfa
        );
    }

    /// @notice Tests that our createFactory function deterministically creates contracts at specific addresses
    /// @dev Explain to a developer any extra details
    /// @param _tokenAddress fuzzed token address
    function testDeterministicAddressCreation(address _tokenAddress) public {
        ISuperToken token = ISuperToken(_tokenAddress);
        address addr = factoryCreator.createFactory(token);
        address computedAddresses1 = factoryCreator.computeAddress(token);
        assertEq(computedAddresses1, addr);
        console.log(addr);
    }
}
