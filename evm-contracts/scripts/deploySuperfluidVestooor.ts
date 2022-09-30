import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre, { ethers } from "hardhat";
import { _console } from "../test/utils";
import { verifyContract } from "./verify";

/**
 * Deploys the Superfluid Vestooor Implementation contract
 * @param signer deployer
 * @returns SuperfluidVestooor Contract
 */
export async function deploySuperfluidVestooor(signer: SignerWithAddress) {
    const SuperfluidVestooorFactory = await ethers.getContractFactory(
        "SuperfluidVestooor"
    );
    const SuperfluidVestooorContract = await SuperfluidVestooorFactory.connect(
        signer
    ).deploy();

    _console(
        "Deployed SuperfluidVestooor at:",
        SuperfluidVestooorContract.address
    );

    // programmatically verify the contract in production
    // https://hardhat.org/plugins/nomiclabs-hardhat-etherscan.html#using-programmatically
    if (
        process.env.VERIFY_CONTRACTS === "true" ||
        (hre.network.name !== "hardhat" && hre.network.name !== "localhost")
    ) {
        _console("Awaiting 6 confirmations before verification...");
        await SuperfluidVestooorContract.deployTransaction.wait(6);

        await verifyContract(hre, SuperfluidVestooorContract.address, []);
    }

    return SuperfluidVestooorContract;
}
