export interface UserSuperTokenInfo {
  readonly userBalance: string;
  readonly underlyingBalance: string;
  // Amount approved to the vesting contract
  readonly availableToVest: string;
}

export interface FlowingBalanceDetails {
  readonly balance: number;
  readonly balanceTimestamp: number;
  readonly flowRate: string;
}

export interface Balance {
  readonly balance: number;
  readonly timestamp: number;
}

export interface VestingInstanceDetails {
  readonly vestee: string;
  readonly amountToVest: string;
  readonly vestingEndDate: Date;
  readonly tokenSymbol: string;
  readonly tokenName: string;
  readonly flowingBalanceDetails: FlowingBalanceDetails;
}

export interface TokenFactoryInfo {
  readonly factory: string;
  readonly symbol: string;
  readonly name: string;
}
