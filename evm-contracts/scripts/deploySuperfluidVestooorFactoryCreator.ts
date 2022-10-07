import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Framework } from "@superfluid-finance/sdk-core";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { verifyContract } from "./verify";

/**
 * Deploys the Superfluid Vestooor Factory Creator contract
 * @param hre hardhat runtime environment
 * @param signer deployer
 * @param vestingImplAddress vestooor implementation contract address
 * @param tokenAddress the address of the super token to be vested
 * @param framework superfluid SDK-Core framework class
 * @returns SuperfluidVestooorFactoryCreator Contract
 */
export async function deployVestingFactoryCreatorContract(
    hre: HardhatRuntimeEnvironment,
    signer: SignerWithAddress,
    vestingImplAddress: string,
    framework: Framework
) {
    const SFVestooorFactoryCreatorContractFactory =
        await hre.ethers.getContractFactory("SuperfluidVestooorFactoryCreator");
    const SuperfluidVestooorFactoryCreator =
        await SFVestooorFactoryCreatorContractFactory.connect(signer).deploy(
            vestingImplAddress,
            framework.host.contract.address,
            framework.cfaV1.contract.address
        );

    console.log(
        "Deployed SuperfluidVestooorFactoryCreator at:",
        SuperfluidVestooorFactoryCreator.address
    );

    // programmatically verify the contract in production
    // https://hardhat.org/plugins/nomiclabs-hardhat-etherscan.html#using-programmatically
    if (
        process.env.VERIFY_CONTRACTS ||
        (hre.network.name !== "hardhat" && hre.network.name !== "localhost")
    ) {
        console.log("Awaiting 6 confirmations before verification...");
        await SuperfluidVestooorFactoryCreator.deployTransaction.wait(6);

        await verifyContract(hre, SuperfluidVestooorFactoryCreator.address, [
            vestingImplAddress,
            framework.host.contract.address,
            framework.cfaV1.contract.address,
        ]);
    }

    return SuperfluidVestooorFactoryCreator;
}
