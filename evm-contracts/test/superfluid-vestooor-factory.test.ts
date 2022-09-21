import { expect } from "chai";
import { ethers } from "hardhat";

import { _makeSuite, TestEnvironment } from "./TestEnvironment";
import {
    _console,
    buildVestee,
    buildVestees,
    createMultipleVestingContractPromise,
    createSingleVestingContractPromise,
    getEndTimestamp,
    mintTokensAndUpgrade,
} from "./utils";

_makeSuite("SuperfluidVestooorFactory Tests", (testEnv: TestEnvironment) => {
    describe("Negative Cases", function () {
        it("Owner cannot transfer ownership to zero address", async () => {
            await expect(
                testEnv.SuperfluidVestooorFactory.connect(
                    testEnv.admin
                ).transferOwnership(ethers.constants.AddressZero)
            ).to.be.revertedWith("Ownable: new owner is the zero address");
        });

        it("Owner cannot create a vesting contract without tokens", async () => {
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
            ).to.be.revertedWithCustomError(
                testEnv.cfaV1,
                "INSUFFICIENT_BALANCE"
            );
        });

        it("Owner cannot create a vesting contract without approval", async () => {
            await mintTokensAndUpgrade(
                testEnv,
                testEnv.admin,
                testEnv.constants.TOTAL_SUPPLY
            );
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
            ).to.be.revertedWith(
                "SuperToken: transfer amount exceeds allowance"
            );
        });

        it("Non-owner should not be able to transfer ownership", async () => {
            await expect(
                testEnv.SuperfluidVestooorFactory.connect(
                    testEnv.alice
                ).transferOwnership(testEnv.alice.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Non-Owner should not be able to create a single vesting contract", async () => {
            const endTimestamp = await getEndTimestamp();
            const vestee = buildVestee(
                testEnv.alice.address,
                testEnv.constants.DEFAULT_VEST_AMOUNT,
                endTimestamp
            );
            await expect(
                createSingleVestingContractPromise(
                    testEnv,
                    testEnv.alice,
                    vestee
                )
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Non-Owner should not be able to create multiple vesting contracts", async () => {
            const vesteeAddresses = testEnv.users
                .slice(1, 11)
                .map((x) => x.address);
            const vestees = await buildVestees(vesteeAddresses);
            await expect(
                createMultipleVestingContractPromise(
                    testEnv,
                    testEnv.alice,
                    vestees
                )
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Happy Path", function () {
        it("Owner should be deployer", async () => {
            expect(await testEnv.SuperfluidVestooorFactory.owner()).to.equal(
                testEnv.admin.address
            );
        });

        it("Owner should be able to renounce ownership", async () => {
            await testEnv.SuperfluidVestooorFactory.connect(
                testEnv.admin
            ).renounceOwnership();
            expect(await testEnv.SuperfluidVestooorFactory.owner()).to.equal(
                ethers.constants.AddressZero
            );
        });

        context("Vesting Contract Creation", () => {
            this.beforeEach(async function () {
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
            });

            it("Should be able to create a single vesting contract", async () => {
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
                ).to.emit(
                    testEnv.SuperfluidVestooorFactory,
                    "VestingContractCreated"
                );
            });

            it("Should be able to create multiple vesting contracts", async () => {
                const vestees = await buildVestees(
                    testEnv.users.slice(1, 11).map((x) => x.address)
                );
                await createMultipleVestingContractPromise(
                    testEnv,
                    testEnv.admin,
                    vestees
                );
            });
        });
    });
});
