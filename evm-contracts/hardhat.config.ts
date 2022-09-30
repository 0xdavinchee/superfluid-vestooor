import { HardhatUserConfig, task, types } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { config as dotenvConfig } from "dotenv";
import "@nomiclabs/hardhat-web3";
import { ethers } from "ethers";
import { deployVestingFactoryContract } from "./scripts/deploySuperfluidVestooorFactory";
import { Framework } from "@superfluid-finance/sdk-core";

// .env Initialization
try {
    dotenvConfig();
} catch (error) {
    console.error(
        "Loading .env file failed. Things will likely fail. You may want to copy .env.template and create a new one."
    );
}

// Hardhat Tasks
task("deploy-factory", "Deploy the SuperfluidVestooorFactory contract")
    .addParam(
        "implementation",
        "The SuperfluidVestooor implementation contract address",
        ethers.constants.AddressZero,
        types.string
    )
    .addParam(
        "token",
        "The vested supertoken contract address",
        ethers.constants.AddressZero,
        types.string
    )
    .setAction(async ({ implementation, token }, hre) => {
        const signer = (await hre.ethers.getSigners())[0];
        const framework = await Framework.create({
            provider: hre.ethers.provider,
            chainId: hre.network.config.chainId!,
        });
        await deployVestingFactoryContract(
            hre,
            signer,
            implementation,
            token,
            framework
        );
    });

const config: HardhatUserConfig = {
    solidity: "0.8.17",
    networks: {
        hardhat: {
            forking: {
                enabled: process.env.ALCHEMY_FORK_URL !== "",
                url: process.env.ALCHEMY_FORK_URL || "",
                // blockNumber: Number(process.env.PINNED_BLOCK),
            },
        },
        localhost: {
            url: "http://127.0.0.1:8545",
            chainId: 31337,
        },
        goerli: {
            url: process.env.GOERLI_RPC_URL,
            accounts: process.env.TEST_ACCOUNT_PRIVATE_KEY
                ? [process.env.TEST_ACCOUNT_PRIVATE_KEY]
                : [],
            chainId: 5,
        },
    },
    etherscan: {
        apiKey: {
            mainnet: process.env.ETHERSCAN_API || "",
            goerli: process.env.ETHERSCAN_API || "",
        },
    },
};

export default config;
