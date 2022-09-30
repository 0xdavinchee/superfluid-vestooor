import { ethers } from "hardhat";
import { deploySuperfluidVestooor } from "./deploySuperfluidVestooor";

/**
 * Deploy the SuperfluidVestooor Implementation Contract
 */
async function main() {
    // signer is the account we set in hardhat.config.ts
    const signer = (await ethers.getSigners())[0];
    await deploySuperfluidVestooor(signer);
}

main()
    .then(() => {
        process.exit();
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
