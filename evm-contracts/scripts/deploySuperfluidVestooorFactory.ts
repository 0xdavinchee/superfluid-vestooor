import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { _console } from "../test/utils";

/**
 * Deploys the Superfluid Vestooor Factory contract
 * @param signer deployer
 * @param vestingImplAddress vestooor implementation contract address
 * @param operatorAddress operator who can stop vesting
 * @returns SuperfluidVestooorFactory Contract
 */
export async function deployVestingFactoryContract(
    signer: SignerWithAddress,
    vestingImplAddress: string
) {
    const SuperfluidVestooorFactoryFactory = await ethers.getContractFactory(
        "SuperfluidVestooorFactory"
    );
    const SuperfluidVestooorFactoryContract =
        await SuperfluidVestooorFactoryFactory.connect(signer).deploy(
            vestingImplAddress
        );
    const SuperfluidVestooorFactory =
        await SuperfluidVestooorFactoryContract.deployed();
    _console(
        "Deployed SuperfluidVestooorFactory at:",
        SuperfluidVestooorFactory.address
    );

    return SuperfluidVestooorFactory;
}
