import ethers, { ContractReceipt, ContractTransaction } from "ethers";

export const getInstanceAddresses = async (receipt: ContractReceipt) => {
  const { events } = receipt;
  if (events) {
    const vestingContractCreatedEvents = events.filter(
      (x) => x.event === "VestingContractCreated"
    );
    const instanceAddresses = vestingContractCreatedEvents.map(
      (x) => x.args!.instanceAddress
    );
    return instanceAddresses;
  }
  return [ethers.constants.AddressZero];
};
