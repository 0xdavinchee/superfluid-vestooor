import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { config as dotenvConfig } from "dotenv";
import "@nomiclabs/hardhat-web3";

try {
    dotenvConfig();
} catch (error) {
    console.error(
        "Loading .env file failed. Things will likely fail. You may want to copy .env.template and create a new one."
    );
}

const config: HardhatUserConfig = {
    solidity: "0.8.17",
    networks: {
        localhost: {
            url: "http://127.0.0.1:8545",
            chainId: 31337,
        },
    },
};

export default config;
