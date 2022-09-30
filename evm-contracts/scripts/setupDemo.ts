import deployFramework from "@superfluid-finance/ethereum-contracts/scripts/deploy-framework";
import hre, { ethers } from "hardhat";
import { errorHandler } from "./deploySuperfluidFramework";
import TestTokenArtifact from "@superfluid-finance/ethereum-contracts/build/contracts/TestToken.json";
import { deployTestTokenAndSuperToken } from "./deployTestTokenAndSuperToken";
import { deploySuperfluidVestooor } from "./deploySuperfluidVestooor";
import { deployVestingFactoryContract } from "./deploySuperfluidVestooorFactory";
import { Framework } from "@superfluid-finance/sdk-core";
import { TestToken } from "@superfluid-finance/sdk-core/dist/module/typechain";

/**
 * Handles Contract and Token Creation for Demo
 * Deploys Framework
 * Deploys fDAIx and fUSDCx tokens
 * Deploys SuperfluidVestooor
 */
async function main() {
    const [Deployer] = await ethers.getSigners();
    await deployFramework((x: any) => errorHandler("Framework", x), {
        web3: (global as any).web3,
        from: Deployer.address,
    });

    const { superTokenAddress: fDAIxAddress } =
        await deployTestTokenAndSuperToken(Deployer.address, "fDAI");
    const { superTokenAddress: fUSDCxAddress } =
        await deployTestTokenAndSuperToken(Deployer.address, "fUSDC");

    const framework = await Framework.create({
        provider: ethers.provider,
        protocolReleaseVersion: "test",
        chainId: ethers.provider.network.chainId,
        resolverAddress: process.env.RESOLVER_ADDRESS,
    });

    const implementationContract = await deploySuperfluidVestooor(Deployer);
    const fDAIVestingFactoryContract = await deployVestingFactoryContract(
        hre,
        Deployer,
        implementationContract.address,
        fDAIxAddress,
        framework
    );
    const fUSDCVestingFactoryContract = await deployVestingFactoryContract(
        hre,
        Deployer,
        implementationContract.address,
        fUSDCxAddress,
        framework
    );
    const chainId = await Deployer.getChainId();
    const sf = await Framework.create({
        chainId,
        provider: Deployer.provider!,
        protocolReleaseVersion: "test",
        resolverAddress: process.env.RESOLVER_ADDRESS,
    });
    const fDAIx = await sf.loadWrapperSuperToken("fDAIx");
    const fUSDCx = await sf.loadWrapperSuperToken("fUSDCx");
    const fDAI = (await ethers.getContractAt(
        TestTokenArtifact.abi,
        fDAIx.underlyingToken.address
    )) as unknown as TestToken;
    const fUSDC = (await ethers.getContractAt(
        TestTokenArtifact.abi,
        fUSDCx.underlyingToken.address
    )) as unknown as TestToken;

    await fDAI.mint(Deployer.address, ethers.utils.parseUnits("10000"));
    await fUSDC.mint(Deployer.address, ethers.utils.parseUnits("10000"));

    console.log(
        "fDAIVestingFactoryContract deployed at:",
        fDAIVestingFactoryContract.address
    );
    console.log(
        "fUSDCVestingFactoryContract deployed at:",
        fUSDCVestingFactoryContract.address
    );
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
