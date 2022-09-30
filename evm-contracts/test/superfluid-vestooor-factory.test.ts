import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "ethers";

import { _makeSuite, TestEnvironment } from "./TestEnvironment";
import {
    buildVestee,
    buildVestees,
    createMultipleVestingContractPromise,
    createSingleVestingContractPromise,
    getEndTimestamp,
    getTotalAmountToBeVested,
    mintTokens,
    toBN,
} from "./utils";

_makeSuite("SuperfluidVestooorFactory Tests", (testEnv: TestEnvironment) => {
    describe("Negative Cases", function () {
        it("Owner cannot create a vesting contract without approval", async () => {
            const endTimestamp = await getEndTimestamp();
            const vestee = buildVestee(
                testEnv.alice.address,
                testEnv.constants.DEFAULT_VEST_AMOUNT,
                endTimestamp
            );
            await expect(
                createSingleVestingContractPromise(
                    testEnv,
                    testEnv.admin,
                    vestee
                )
            ).to.be.revertedWith("ERC20: insufficient allowance");
        });

        context("Invalid Vestee Data Tests", () => {
            beforeEach(async () => {
                await mintTokens(
                    testEnv,
                    testEnv.admin,
                    testEnv.constants.TOTAL_SUPPLY
                );
                await testEnv.token
                    .connect(testEnv.admin)
                    .approve(
                        testEnv.SuperfluidVestooorFactory.address,
                        testEnv.constants.TOTAL_SUPPLY
                    );
            });

            it("Cannot create vesting contract to zero address vestee", async () => {
                const endTimestamp = await getEndTimestamp();
                const vestee = buildVestee(
                    ethers.constants.AddressZero,
                    testEnv.constants.DEFAULT_VEST_AMOUNT,
                    endTimestamp
                );
                await expect(
                    createSingleVestingContractPromise(
                        testEnv,
                        testEnv.admin,
                        vestee
                    )
                ).to.be.revertedWithCustomError(
                    testEnv.SuperfluidVestooorFactory,
                    "NO_ZERO_ADDRESS_VESTEE"
                );
            });

            it("Cannot create vesting contract for zero tokens to vest", async () => {
                const endTimestamp = await getEndTimestamp();
                const vestee = buildVestee(
                    testEnv.alice.address,
                    toBN(0),
                    endTimestamp
                );
                await expect(
                    createSingleVestingContractPromise(
                        testEnv,
                        testEnv.admin,
                        vestee
                    )
                ).to.be.revertedWithCustomError(
                    testEnv.SuperfluidVestooorFactory,
                    "ZERO_TOKENS_TO_VEST"
                );
            });

            it("Cannot create vesting contract where end time is earlier than now", async () => {
                const currentBlock = await hre.ethers.provider.getBlock(
                    "latest"
                );
                const endTimestamp = currentBlock.timestamp - 3600;
                const vestee = buildVestee(
                    testEnv.alice.address,
                    testEnv.constants.DEFAULT_VEST_AMOUNT,
                    endTimestamp
                );
                await expect(
                    createSingleVestingContractPromise(
                        testEnv,
                        testEnv.admin,
                        vestee
                    )
                ).to.be.revertedWithCustomError(
                    testEnv.SuperfluidVestooorFactory,
                    "VESTING_END_TIME_TOO_EARLY"
                );
            });

            it("Cannot create vesting contracts with empty array", async () => {
                const totalAmountToBeVested = getTotalAmountToBeVested([]);

                await expect(
                    createMultipleVestingContractPromise(
                        testEnv,
                        testEnv.admin,
                        [],
                        totalAmountToBeVested
                    )
                ).to.be.revertedWithCustomError(
                    testEnv.SuperfluidVestooorFactory,
                    "ZERO_TOKENS_TO_VEST"
                );
            });

            it("Cannot create vesting contracts with zero tokens to vest", async () => {
                const vestees = await buildVestees(
                    testEnv.users.slice(1, 11).map((x) => x.address),
                    toBN(0)
                );
                const totalAmountToBeVested = getTotalAmountToBeVested(vestees);

                await expect(
                    createMultipleVestingContractPromise(
                        testEnv,
                        testEnv.admin,
                        vestees,
                        totalAmountToBeVested
                    )
                ).to.be.revertedWithCustomError(
                    testEnv.SuperfluidVestooorFactory,
                    "ZERO_TOKENS_TO_VEST"
                );
            });

            it("Cannot create vesting contracts with a single zero token to vest vestee", async () => {
                const oneVestee = await buildVestees(
                    testEnv.users.slice(1, 2).map((x) => x.address)
                );
                const endTimestamp = await getEndTimestamp();
                const vestee = buildVestee(
                    testEnv.users[3].address,
                    toBN(0),
                    endTimestamp
                );
                const vestees = [...oneVestee, vestee];
                const totalAmountToBeVested = getTotalAmountToBeVested(vestees);

                await expect(
                    createMultipleVestingContractPromise(
                        testEnv,
                        testEnv.admin,
                        vestees,
                        totalAmountToBeVested
                    )
                ).to.be.revertedWithCustomError(
                    testEnv.SuperfluidVestooorFactory,
                    "ZERO_TOKENS_TO_VEST"
                );
            });

            it("Cannot create vesting contracts with a single zero address vestee", async () => {
                const oneVestee = await buildVestees(
                    testEnv.users.slice(1, 2).map((x) => x.address)
                );
                const endTimestamp = await getEndTimestamp();
                const vestee = buildVestee(
                    ethers.constants.AddressZero,
                    testEnv.constants.DEFAULT_VEST_AMOUNT,
                    endTimestamp
                );
                const vestees = [...oneVestee, vestee];
                const totalAmountToBeVested = getTotalAmountToBeVested(vestees);

                await expect(
                    createMultipleVestingContractPromise(
                        testEnv,
                        testEnv.admin,
                        vestees,
                        totalAmountToBeVested
                    )
                ).to.be.revertedWithCustomError(
                    testEnv.SuperfluidVestooorFactory,
                    "NO_ZERO_ADDRESS_VESTEE"
                );
            });

            it("Cannot create vesting contracts with a single end timestamp earlier than now", async () => {
                const oneVestee = await buildVestees(
                    testEnv.users.slice(1, 2).map((x) => x.address)
                );
                const currentBlock = await hre.ethers.provider.getBlock(
                    "latest"
                );
                const endTimestamp = currentBlock.timestamp - 3600;
                const vestee = buildVestee(
                    testEnv.alice.address,
                    testEnv.constants.DEFAULT_VEST_AMOUNT,
                    endTimestamp
                );
                const vestees = [...oneVestee, vestee];
                const totalAmountToBeVested = getTotalAmountToBeVested(vestees);

                await expect(
                    createMultipleVestingContractPromise(
                        testEnv,
                        testEnv.admin,
                        vestees,
                        totalAmountToBeVested
                    )
                ).to.be.revertedWithCustomError(
                    testEnv.SuperfluidVestooorFactory,
                    "VESTING_END_TIME_TOO_EARLY"
                );
            });
        });
    });

    describe("Happy Path", function () {
        context("Vesting Contract Creation", () => {
            beforeEach(async function () {
                await mintTokens(
                    testEnv,
                    testEnv.admin,
                    testEnv.constants.TOTAL_SUPPLY
                );
            });

            it("Should be able to create a single vesting contract", async () => {
                const endTimestamp = await getEndTimestamp();
                const vestee = buildVestee(
                    testEnv.alice.address,
                    testEnv.constants.DEFAULT_VEST_AMOUNT,
                    endTimestamp
                );
                const totalAmountToBeVested = getTotalAmountToBeVested([
                    vestee,
                ]);

                await testEnv.token
                    .connect(testEnv.admin)
                    .approve(
                        testEnv.SuperfluidVestooorFactory.address,
                        totalAmountToBeVested
                    );

                await expect(
                    createSingleVestingContractPromise(
                        testEnv,
                        testEnv.admin,
                        vestee
                    )
                ).to.emit(
                    testEnv.SuperfluidVestooorFactory,
                    "VestingContractCreated"
                );
            });

            it("Should be able to create multiple vesting contracts", async () => {
                const vestees = await buildVestees(
                    testEnv.users.slice(1, 11).map((x) => x.address)
                );
                const totalAmountToBeVested = getTotalAmountToBeVested(vestees);

                await testEnv.token
                    .connect(testEnv.admin)
                    .approve(
                        testEnv.SuperfluidVestooorFactory.address,
                        totalAmountToBeVested
                    );

                await createMultipleVestingContractPromise(
                    testEnv,
                    testEnv.admin,
                    vestees,
                    totalAmountToBeVested
                );
            });
        });
    });
});
