import {
    SnapshotRestorer,
    takeSnapshot,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import CFAv1Artifact from "@superfluid-finance/ethereum-contracts/build/contracts/ConstantFlowAgreementV1.json";
import TestTokenArtifact from "@superfluid-finance/ethereum-contracts/build/contracts/TestToken.json";
import { Framework, WrapperSuperToken } from "@superfluid-finance/sdk-core";
import { TestToken } from "@superfluid-finance/sdk-core/dist/module/typechain";
import { Contract } from "ethers";
import { ethers } from "hardhat";

import { deployFrameworkAndSuperTokens } from "../scripts/deploySuperfluidFramework";
import { deploySuperfluidVestooor } from "../scripts/deploySuperfluidVestooor";
import { deployVestingFactoryContract } from "../scripts/deploySuperfluidVestooorFactory";
import {
    SuperfluidVestooor,
    SuperfluidVestooorFactory,
} from "../typechain-types";

import { _console } from "./utils";

export const TEST_ENVIRONMENT_CONSTANTS = {
    DEFAULT_VEST_DURATION: 31536000,
    DEFAULT_VEST_AMOUNT: ethers.utils.parseUnits("68"),
    TOTAL_SUPPLY: ethers.utils.parseUnits("1000000"),
};

export interface TestEnvironment {
    framework: Framework;
    constants: typeof TEST_ENVIRONMENT_CONSTANTS;
    users: SignerWithAddress[];
    admin: SignerWithAddress;
    alice: SignerWithAddress;
    cfaV1: Contract;
    token: TestToken;
    superToken: WrapperSuperToken;
    SuperfluidVestooorFactory: SuperfluidVestooorFactory;
    SuperfluidVestooor: SuperfluidVestooor;
    snapshot: SnapshotRestorer;
}

const testEnv: TestEnvironment = {
    framework: {} as Framework,
    constants: TEST_ENVIRONMENT_CONSTANTS,
    users: [],
    admin: {} as SignerWithAddress,
    alice: {} as SignerWithAddress,
    cfaV1: {} as Contract,
    token: {} as TestToken,
    superToken: {} as WrapperSuperToken,
    SuperfluidVestooorFactory: {} as SuperfluidVestooorFactory,
    SuperfluidVestooor: {} as SuperfluidVestooor,
    snapshot: {} as SnapshotRestorer,
};

/**
 * Initializes Test Environment Object
 * - Deploys Superfluid Vestooor implementation Contract
 * - Deploys Superfluid Vestooor Factory Contract
 */
export const initializeTestEnvironment = async () => {
    // Deploy Superfluid Framework, Test Token, Wrapper Super Token,
    // and Native Asset Super Token.
    await deployFrameworkAndSuperTokens();

    // Create SDK-Core Framework
    _console("Create SDK-Core Framework");
    testEnv.framework = await Framework.create({
        provider: ethers.provider,
        protocolReleaseVersion: "test",
        chainId: ethers.provider.network.chainId,
        resolverAddress: process.env.RESOLVER_ADDRESS,
    });

    _console("Load Wrapper SuperToken");
    testEnv.superToken = await testEnv.framework.loadWrapperSuperToken("fDAIx");
    testEnv.token = (await ethers.getContractAt(
        TestTokenArtifact.abi,
        testEnv.superToken.underlyingToken.address
    )) as unknown as TestToken;

    const signers = await ethers.getSigners();
    [testEnv.admin, testEnv.alice, ...testEnv.users] = signers;

    testEnv.cfaV1 = await ethers.getContractAt(
        CFAv1Artifact.abi,
        testEnv.framework.cfaV1.contract.address
    );

    testEnv.SuperfluidVestooor = await deploySuperfluidVestooor(testEnv.admin);
    testEnv.SuperfluidVestooorFactory = await deployVestingFactoryContract(
        testEnv.admin,
        testEnv.SuperfluidVestooor.address
    );
};

export const _makeSuite = (
    name: string,
    tests: (testEnvironment: TestEnvironment) => void
) => {
    describe(name, () => {
        before(async () => {
            testEnv.snapshot = await takeSnapshot();
        });
        tests(testEnv);
        beforeEach(async () => {
            await testEnv.snapshot.restore();
        });
    });
};
