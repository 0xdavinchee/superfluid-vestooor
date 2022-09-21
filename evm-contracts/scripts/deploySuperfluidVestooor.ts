import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { _console } from "../test/utils";

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
    const SuperfluidVestooor = await SuperfluidVestooorContract.deployed();
    _console("Deployed SuperfluidVestooor at:", SuperfluidVestooor.address);

    return SuperfluidVestooor;
}
