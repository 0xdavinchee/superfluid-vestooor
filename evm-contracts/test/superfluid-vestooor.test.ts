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
    getInstanceAddresses,
    mintTokens,
    toBN,
} from "./utils";

_makeSuite("Superfluid Vestoooor Tests", (testEnv: TestEnvironment) => {
    let instanceAddress: string;
    let SuperfluidVestooor: SuperfluidVestooor;

    const createVestingContract = async (
        vesteeAddress: string,
        amount = testEnv.constants.DEFAULT_VEST_AMOUNT,
        timeToGoForwards = testEnv.constants.DEFAULT_VEST_DURATION
    ) => {
        await mintTokens(
            testEnv,
            testEnv.admin,
            testEnv.constants.TOTAL_SUPPLY
        );
        await testEnv.token
            .connect(testEnv.admin)
            .approve(
                testEnv.SuperfluidVestooorFactory.address,
                testEnv.constants.TOTAL_SUPPLY.toString()
            );

        const endTimestamp = await getEndTimestamp(timeToGoForwards);
        const vestee = buildVestee(vesteeAddress, amount, endTimestamp);

        _console("Create Vesting contract for:", vesteeAddress);
        const txn = await createSingleVestingContractPromise(
            testEnv,
            testEnv.admin,
            vestee
        );
        const receipt = await txn.wait();
        instanceAddress = (await getInstanceAddresses(receipt))[0];
        const superfluidVestooor = await ethers.getContractAt(
            "SuperfluidVestooor",
            instanceAddress
        );

        return { superfluidVestooor, endTimestamp };
    };

    describe("Negative Cases", function () {
        beforeEach(async () => {
            const { superfluidVestooor } = await createVestingContract(
                testEnv.alice.address
            );
            SuperfluidVestooor = superfluidVestooor;
        });

        it("Should not be able to initialize again.", async () => {
            const ZERO_ADDRESS = ethers.constants.AddressZero;
            await expect(
                SuperfluidVestooor.connect(testEnv.alice).initialize(
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                    "200",
                    "200000"
                )
            ).to.be.revertedWith(
                "Initializable: contract is already initialized"
            );
        });

        it("Should not be able to end vesting if vesting endable window is not reached.", async () => {
            await expect(
                SuperfluidVestooor.connect(testEnv.alice).stopVesting()
            ).to.be.revertedWithCustomError(
                SuperfluidVestooor,
                "VESTING_END_TOO_EARLY"
            );
        });

        it("Should not be able to restart vesting if vesting is in progress", async () => {
            await expect(
                SuperfluidVestooor.connect(testEnv.alice).restartVesting()
            ).to.be.revertedWithCustomError(
                SuperfluidVestooor,
                "VESTING_IN_PROGRESS"
            );
        });
    });

    describe("Happy Path Cases", function () {
        it("Should be able to go through a full vesting", async () => {
            const { superfluidVestooor, endTimestamp } =
                await createVestingContract(testEnv.alice.address);
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

        context("Restart Vesting", () => {
            it("Should be able to restart vesting during vesting endable window.", async () => {
                const { superfluidVestooor, endTimestamp } =
                    await createVestingContract(testEnv.alice.address);
                SuperfluidVestooor = superfluidVestooor;
                const ONE_WEEK_IN_SECS = 604800;

                // advance to a week before vesting ends
                await time.increaseTo(endTimestamp - ONE_WEEK_IN_SECS);

                // receiver deletes the flow
                await testEnv.superToken
                    .deleteFlow({
                        sender: superfluidVestooor.address,
                        receiver: testEnv.alice.address,
                    })
                    .exec(testEnv.alice);

                // restart vesting
                await expect(
                    SuperfluidVestooor.connect(testEnv.admin).restartVesting()
                ).to.emit(SuperfluidVestooor, "VestingEnded");

                // vestee receives full amount if restart vesting occurs during vesting endable window
                expect(
                    await testEnv.superToken.balanceOf({
                        account: testEnv.alice.address,
                        providerOrSigner: testEnv.alice,
                    })
                ).to.be.equal(testEnv.constants.DEFAULT_VEST_AMOUNT);
            });

            it("Should be able to restart vesting before vesting endable window.", async () => {
                const { superfluidVestooor, endTimestamp } =
                    await createVestingContract(testEnv.alice.address);
                SuperfluidVestooor = superfluidVestooor;
                const ONE_WEEK_IN_SECS = 604800;

                // advance to two weeks before vesting ends
                await time.increaseTo(endTimestamp - ONE_WEEK_IN_SECS * 2);

                // receiver deletes the flow
                await testEnv.superToken
                    .deleteFlow({
                        sender: superfluidVestooor.address,
                        receiver: testEnv.alice.address,
                    })
                    .exec(testEnv.alice);

                // restart vesting
                const restartVestingTxn = await SuperfluidVestooor.connect(
                    testEnv.admin
                ).restartVesting();

                // get the block for timestamp of restart vesting tx
                const restartVestingReceipt = await restartVestingTxn.wait();
                const restartVestingBlock = await ethers.provider.getBlock(
                    restartVestingReceipt.blockNumber
                );

                // calculate the original flow rate (we assume nobody has deposited tokens)
                const totalAmountToVest =
                    await SuperfluidVestooor.amountToVest();
                const startTimestamp =
                    await SuperfluidVestooor.vestingStartTimestamp();
                const vestingFlowRate = totalAmountToVest.div(
                    toBN(endTimestamp).sub(startTimestamp)
                );

                // get what is remaining to be streamed
                const remainingToBeStreamed = toBN(endTimestamp)
                    .sub(toBN(restartVestingBlock.timestamp))
                    .mul(vestingFlowRate);

                // get the total amount streamed so far
                const totalStreamedSoFar = totalAmountToVest.sub(
                    remainingToBeStreamed
                );
                const vesteeBalanceAtRestart = (
                    await testEnv.superToken.realtimeBalanceOf({
                        account: testEnv.alice.address,
                        providerOrSigner: testEnv.alice,
                        timestamp: restartVestingBlock.timestamp,
                    })
                ).availableBalance;

                expect(totalStreamedSoFar).to.equal(vesteeBalanceAtRestart);
            });

            it("Should be able to restart vesting before vesting endable window and then end in vesting endable window.", async () => {
                const { superfluidVestooor, endTimestamp } =
                    await createVestingContract(testEnv.alice.address);
                SuperfluidVestooor = superfluidVestooor;
                const ONE_WEEK_IN_SECS = 604800;

                // advance to two weeks before vesting ends
                await time.increaseTo(endTimestamp - ONE_WEEK_IN_SECS * 2);

                // receiver deletes the flow
                await testEnv.superToken
                    .deleteFlow({
                        sender: superfluidVestooor.address,
                        receiver: testEnv.alice.address,
                    })
                    .exec(testEnv.alice);

                // restart vesting
                await SuperfluidVestooor.connect(
                    testEnv.admin
                ).restartVesting();

                // advance to one week before vesting ends
                await time.increaseTo(endTimestamp - ONE_WEEK_IN_SECS);

                await expect(
                    SuperfluidVestooor.connect(testEnv.admin).stopVesting()
                ).to.emit(SuperfluidVestooor, "VestingEnded");

                // vestee receives full amount still
                expect(
                    await testEnv.superToken.balanceOf({
                        account: testEnv.alice.address,
                        providerOrSigner: testEnv.alice,
                    })
                ).to.be.equal(testEnv.constants.DEFAULT_VEST_AMOUNT);
            });
        });
    });
});
