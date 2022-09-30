import deployTestToken from "@superfluid-finance/ethereum-contracts/scripts/deploy-test-token";
import deploySuperToken from "@superfluid-finance/ethereum-contracts/scripts/deploy-super-token";
import { errorHandler } from "./deploySuperfluidFramework";

export const deployTestTokenAndSuperToken = async (
    deployer: string,
    symbol: string
) => {
    const testTokenAddress = await deployTestToken(
        (x: any) => errorHandler("TestToken", x),
        [":", symbol],
        {
            web3: (global as any).web3,
            from: deployer,
        }
    );
    // deploy wrapper super token
    const superTokenAddress = await deploySuperToken(
        (x: any) => errorHandler("SuperToken", x),
        [":", symbol],
        {
            web3: (global as any).web3,
            from: deployer,
        }
    );

    return { testTokenAddress, superTokenAddress };
};
