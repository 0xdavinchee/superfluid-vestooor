import ethers, { ContractReceipt, ContractTransaction } from "ethers";
import { Balance } from "../interfaces/interfaces";

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

export const getTotalFlowedBalance = (
  totalFlowedData: Balance,
  flowRate: string,
  time: Date
) => {
  return (
    totalFlowedData.balance -
    (time.getTime() / 1000 - totalFlowedData.timestamp) * Number(flowRate)
  );
};
