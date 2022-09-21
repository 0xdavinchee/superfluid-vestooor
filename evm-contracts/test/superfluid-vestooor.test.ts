import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { SuperfluidVestooor } from "../typechain-types";

import { _makeSuite, TestEnvironment } from "./TestEnvironment";
import {
    _console,
    buildVestee,
    createSingleVestingContractPromise,
    getEndTimestamp,
    getInstanceAddress,
    mintTokensAndUpgrade,
} from "./utils";

_makeSuite("Superfluid Vestoooor Tests", (testEnv: TestEnvironment) => {
    let instanceAddress: string;
    let SuperfluidVestooor: SuperfluidVestooor;

    const createVestingContract = async () => {
        await mintTokensAndUpgrade(
            testEnv,
            testEnv.admin,
            testEnv.constants.TOTAL_SUPPLY
        );
        await testEnv.superToken
            .approve({
                receiver: testEnv.SuperfluidVestooorFactory.address,
                amount: testEnv.constants.TOTAL_SUPPLY.toString(),
            })
            .exec(testEnv.admin);

        const endTimestamp = await getEndTimestamp();
        const vestee = buildVestee(
            testEnv.alice.address,
            testEnv.constants.DEFAULT_VEST_AMOUNT,
            endTimestamp
        );

        _console("Create Vesting contract for:", testEnv.alice.address);
        const txn = await createSingleVestingContractPromise(
            testEnv,
            testEnv.admin,
            vestee
        );
        instanceAddress = await getInstanceAddress(txn);
        const superfluidVestooor = await ethers.getContractAt(
            "SuperfluidVestooor",
            instanceAddress
        );

        return { superfluidVestooor, endTimestamp };
    };

    describe("Negative Cases", function () {
        this.beforeEach(async () => {
            const { superfluidVestooor } = await createVestingContract();
            SuperfluidVestooor = superfluidVestooor;
        });

        context("Immediate Vesting Upon Initialization", function () {
            it("Should not be able to end vesting if vesting is not up ", async () => {
                await expect(
                    SuperfluidVestooor.connect(testEnv.alice).stopVesting()
                ).to.be.revertedWithCustomError(
                    SuperfluidVestooor,
                    "VESTING_END_TOO_EARLY"
                );
            });
        });
    });

    describe("Happy Path Cases", function () {
        it("Should be able to go through a full vesting", async () => {
            const { superfluidVestooor, endTimestamp } =
                await createVestingContract();
            SuperfluidVestooor = superfluidVestooor;
            const ONE_WEEK_IN_SECS = 604800;

            // advance to a week before vesting ends
            await time.increaseTo(endTimestamp - ONE_WEEK_IN_SECS);

            // stop vesting
            await SuperfluidVestooor.connect(testEnv.admin).stopVesting();

            expect(
                await testEnv.superToken.balanceOf({
                    account: testEnv.alice.address,
                    providerOrSigner: testEnv.alice,
                })
            ).to.be.equal(testEnv.constants.DEFAULT_VEST_AMOUNT);
        });
    });
});
