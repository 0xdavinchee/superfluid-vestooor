import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ContractReceipt, ethers } from "ethers";
import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import styles from "../styles/Home.module.css";
import DatePicker from "react-date-picker/dist/entry.nostyle";
import {
  SuperfluidVestooor,
  SuperfluidVestooorFactory,
} from "../typechain-types";
import SuperfluidVestooorFactoryABI from "../artifacts/contracts/SuperfluidVestooorFactory.sol/SuperfluidVestooorFactory.json";
import SuperfluidVestooorABI from "../artifacts/contracts/SuperfluidVestooor.sol/SuperfluidVestooor.json";
import { useAccount, useProvider, useSigner } from "wagmi";
import { ERC20Token, Framework } from "@superfluid-finance/sdk-core";
import { IFrameworkOptions } from "@superfluid-finance/sdk-core/dist/module/Framework";
import { getInstanceAddresses } from "../utils/utils";

// @note TODO build a map using Framework.query for listed super tokens
const symbolToFactoryAddressMap = new Map([
  ["fDAIx", "0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E"],
  ["fUSDCx", "0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690"],
]);

interface SuperTokenInfo {
  readonly userBalance: string;
  readonly name: string;
  readonly underlyingBalance: string;
  // Amount approved to the vesting contract
  readonly availableToVest: string;
}

interface FlowingBalanceDetails {
  readonly balance: number;
  readonly balanceTimestamp: number;
  readonly flowRate: string;
}

interface Balance {
  readonly balance: number;
  readonly timestamp: number;
}

interface VestingInstanceDetails {
  readonly vestee: string;
  readonly amountToVest: string;
  readonly vestingEndDate: Date;
  readonly tokenSymbol: string;
  readonly tokenName: string;
  readonly flowingBalanceDetails: FlowingBalanceDetails;
}

const Home: NextPage = () => {
  const [totalVestAmount, setTotalVestAmount] = useState("");
  const [selectedTokenSymbol, setSelectedTokenSymbol] = useState("");
  const [selectedVestee, setSelectedVestee] = useState("");
  const [framework, setFramework] = useState<Framework>();
  const [underlyingToken, setUnderlyingToken] = useState<ERC20Token>();
  const [tokenInfo, setTokenInfo] = useState<SuperTokenInfo>();
  const [instanceAddresses, setInstanceAddresses] = useState<string[]>([]);
  const [factoryContract, setFactoryContract] =
    useState<SuperfluidVestooorFactory>();
  const [vestees, setVestees] = useState<
    SuperfluidVestooorFactory.VesteeStruct[]
  >([]);
  const [time, setTime] = useState(new Date());
  const [vesteeAddress, setVesteeAddress] = useState("");
  const [vesteeAmountToVest, setVesteeAmountToVest] = useState("");
  const [vesteeEndTimestamp, setVesteeEndTimestamp] = useState(new Date());

  const [instanceAddress, setInstanceAddress] = useState("");
  const [instanceDetails, setInstanceDetails] =
    useState<VestingInstanceDetails>({
      vestee: "",
      amountToVest: "",
      vestingEndDate: new Date(),
      tokenSymbol: "",
      tokenName: "",
      flowingBalanceDetails: { balance: 0, balanceTimestamp: 0, flowRate: "" },
    });

  // wagmi hooks
  const provider = useProvider();
  const { data: signer } = useSigner();
  const account = useAccount();

  const getTotalFlowedBalance = (
    totalFlowedData: Balance,
    flowRate: string
  ) => {
    return (
      totalFlowedData.balance -
      (time.getTime() / 1000 - totalFlowedData.timestamp) * Number(flowRate)
    );
  };
  const remainingVestAmount = useMemo(() => {
    const totalFlowedData: Balance = {
      balance: instanceDetails.flowingBalanceDetails.balance,
      timestamp: instanceDetails.flowingBalanceDetails.balanceTimestamp,
    };

    return getTotalFlowedBalance(
      totalFlowedData,
      instanceDetails.flowingBalanceDetails.flowRate
    );
  }, [
    time,
    instanceDetails.flowingBalanceDetails.balance,
    instanceDetails.flowingBalanceDetails.balanceTimestamp,
    instanceDetails.flowingBalanceDetails.flowRate,
  ]);

  const approve = async () => {
    if (underlyingToken && signer && factoryContract) {
      await underlyingToken
        .approve({
          amount: ethers.utils.parseUnits(totalVestAmount).toString(),
          receiver: factoryContract.address,
        })
        .exec(signer);

      const approvedAmount = await underlyingToken.allowance({
        owner: account.address!,
        spender: factoryContract.address,
        providerOrSigner: provider,
      });

      setTokenInfo({
        ...tokenInfo!,
        availableToVest: ethers.utils.formatUnits(approvedAmount),
      });
    }
  };

  const addVestee = async () => {
    const newVestee: SuperfluidVestooorFactory.VesteeStruct = {
      vesteeAddress,
      amountToVest: ethers.utils.parseUnits(vesteeAmountToVest),
      vestingEndTimestamp: Math.round(vesteeEndTimestamp.getTime() / 1000),
    };
    setVestees([...vestees, newVestee]);
  };

  const updateVestee = async () => {};

  const removeVestee = async () => {};

  const stopVesting = async () => {
    const superfluidVestooor = new ethers.Contract(
      instanceAddress,
      SuperfluidVestooorABI.abi,
      provider
    ) as SuperfluidVestooor;

    await superfluidVestooor.connect(signer!).stopVesting();
  };

  const vest = async () => {
    if (!factoryContract || !framework || !signer) return;
    let receipt: ContractReceipt;
    if (vestees.length > 1) {
      const totalVestAmount = vestees
        .map((x) => ethers.BigNumber.from(x.amountToVest))
        .reduce((a, b) => a.add(b), ethers.BigNumber.from(0));
      const txn = await factoryContract
        .connect(signer)
        .createVestingContracts(vestees, totalVestAmount);
      receipt = await txn.wait();
    } else {
      const txn = await factoryContract
        .connect(signer)
        .createVestingContract(vestees[0]);
      receipt = await txn.wait();
    }
    const instanceAddresses = await getInstanceAddresses(receipt);
    setInstanceAddresses(instanceAddresses);
    localStorage.setItem(
      "INSTANCE_ADDRESSES",
      JSON.stringify(instanceAddresses)
    );
  };

  useEffect(() => {
    (async () => {
      const baseObject = {
        chainId: provider.network.chainId,
        provider,
        protocolReleaseVersion: "test", //process.env.IS_DEV ? "test" : "v1",
      };
      const frameworkOptions: IFrameworkOptions = process.env.IS_DEV
        ? {
            ...baseObject,
          }
        : {
            ...baseObject,
            resolverAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
          };
      const sfFramework = await Framework.create(frameworkOptions);
      setFramework(sfFramework);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const block = await provider.getBlock("latest");
      setTime(new Date(block.timestamp * 1000));
    })();
  }, []);

  // handles loading of tokens
  // @note TODO: handle native asset vs ERC20 later
  useEffect(() => {
    (async () => {
      if (framework && selectedTokenSymbol) {
        const superToken = await framework.loadWrapperSuperToken(
          selectedTokenSymbol
        );
        const factoryAddress =
          symbolToFactoryAddressMap.get(selectedTokenSymbol);
        if (account.address && factoryAddress) {
          const userBalance = await superToken.balanceOf({
            account: account.address,
            providerOrSigner: provider,
          });
          const name = await superToken.name({ providerOrSigner: provider });
          const underlyingBalance = await superToken.underlyingToken.balanceOf({
            account: account.address,
            providerOrSigner: provider,
          });
          const approvedAmount = await superToken.underlyingToken.allowance({
            owner: account.address,
            spender: factoryAddress,
            providerOrSigner: provider,
          });

          setTokenInfo({
            userBalance: ethers.utils.formatUnits(userBalance),
            name,
            underlyingBalance: ethers.utils.formatUnits(underlyingBalance),
            availableToVest: ethers.utils.formatUnits(approvedAmount),
          });
          setUnderlyingToken(superToken.underlyingToken);
        }
      }
    })();
  }, [framework, selectedTokenSymbol]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTime(new Date(time.getTime() + 1000));
    }, 1000);

    return () => clearTimeout(timer);
  });

  // set up contracts
  useEffect(() => {
    const address = symbolToFactoryAddressMap.get(selectedTokenSymbol);
    if (address) {
      setFactoryContract(
        new ethers.Contract(
          address,
          SuperfluidVestooorFactoryABI.abi,
          provider
        ) as SuperfluidVestooorFactory
      );
    }
  }, [selectedTokenSymbol]);

  // load from local storage
  useEffect(() => {
    const instanceAddresses =
      localStorage.getItem("INSTANCE_ADDRESSES") || "[]";
    setInstanceAddresses(JSON.parse(instanceAddresses));
  }, []);

  // load instance details
  useEffect(() => {
    console.log({ instanceAddress });
    if (instanceAddress && framework) {
      const superfluidVestooor = new ethers.Contract(
        instanceAddress,
        SuperfluidVestooorABI.abi,
        provider
      ) as SuperfluidVestooor;
      (async () => {
        const vestee = await superfluidVestooor.vestee();
        const amountToVest = await superfluidVestooor.amountToVest();
        const vestingEndTimestamp =
          await superfluidVestooor.vestingEndTimestamp();
        const vestedTokenAddress = await superfluidVestooor.tokenToVest();
        const vestedToken = await framework.loadWrapperSuperToken(
          vestedTokenAddress
        );
        const currentBlockTime = await provider.getBlock("latest");
        const realtimeBalanceOf = await vestedToken.realtimeBalanceOf({
          account: instanceAddress,
          providerOrSigner: provider,
          timestamp: currentBlockTime.timestamp,
        });
        console.log("currentBlockTime.timestamp", currentBlockTime.timestamp);
        const vestFlowData = await vestedToken.getFlow({
          sender: instanceAddress,
          receiver: vestee,
          providerOrSigner: provider,
        });
        console.log({ vestFlowData });
        console.log(instanceAddress);
        const tokenSymbol = await vestedToken.symbol({
          providerOrSigner: provider,
        });
        const tokenName = await vestedToken.name({
          providerOrSigner: provider,
        });
        const flowingBalanceDetails: FlowingBalanceDetails = {
          balance: Number(realtimeBalanceOf.availableBalance),
          balanceTimestamp: currentBlockTime.timestamp,
          flowRate: vestFlowData.flowRate,
        };
        setInstanceDetails({
          vestee,
          amountToVest: ethers.utils.formatUnits(amountToVest),
          vestingEndDate: new Date(vestingEndTimestamp.toNumber() * 1000),
          tokenSymbol,
          tokenName,
          flowingBalanceDetails,
        });
      })();
    }
  }, [instanceAddress]);

  return (
    <div className={styles.container}>
      <Head>
        <title>Superfluid Vestooor</title>
        <meta name="description" content="A super simple vesting PoC" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <ConnectButton />
        <h1 className={styles.title}>Superfluid Vestooor</h1>
        <p className={styles.description}>Steps to Vest:</p>
        <ol>
          <li>
            Select a token to vest and approve the total amount you'd like to
            vest.
          </li>
          <li>Add vestee(s).</li>
          <li>Click "Vest" and profit.</li>
        </ol>
        <i style={{ maxWidth: "50%" }}>
          NOTE: The deployed vestooor contract addresses will appear on the
          right, you can click on one of the addresses to get more details about
          the instance.
        </i>
        <div className={styles.outerContainer}>
          <div className={styles.insideContainer}>
            <label htmlFor="tokenToVest">Token to Vest</label>
            <select onChange={(x) => setSelectedTokenSymbol(x.target.value)}>
              <option value=""> -- select a token -- </option>
              {Array.from(symbolToFactoryAddressMap).map((x) => (
                <option key={x[0]} value={x[0]}>
                  {x[0]}
                </option>
              ))}
            </select>
            <p>Token Info</p>
            <p>Name: {tokenInfo?.name}</p>
            <p>Symbol: {selectedTokenSymbol}</p>
            <p>Super Token Balance: {tokenInfo?.userBalance}</p>
            <p>Underlying Token Balance: {tokenInfo?.underlyingBalance}</p>
            <p>
              Approved Underlying Amount To Vest: {tokenInfo?.availableToVest}
            </p>
            <label htmlFor="totalVestAmount">Total Vest Amount</label>
            <input
              name="totalVestAmount"
              placeholder="e.g. 42069"
              value={totalVestAmount}
              onChange={(e) => setTotalVestAmount(e.target.value)}
            />
            <p>This is the total amount you want to vest for your vestee(s).</p>
            <button onClick={() => approve()}>Approve Vesting Contract</button>
          </div>
          <div className={styles.insideContainer}>
            <p>Vestee(s)</p>
            <select
              className={styles.selectVestee}
              size={5}
              onChange={(e) => setSelectedVestee(e.target.value)}
            >
              {vestees.map((x) => (
                <option key={x.vesteeAddress as string}>
                  {x.vesteeAddress as string}
                </option>
              ))}
            </select>
            <div className={styles.vesteeInputContainer}>
              <label>Vestee Address</label>
              <input
                className={styles.vesteeInput}
                name="vesteeAddress"
                value={vesteeAddress}
                onChange={(e) => setVesteeAddress(e.target.value)}
              />
            </div>
            <div className={styles.vesteeInputContainer}>
              <label>Vestee Vest Amount</label>
              <input
                className={styles.vesteeInput}
                name="vesteeVestAmount"
                value={vesteeAmountToVest}
                onChange={(e) => setVesteeAmountToVest(e.target.value)}
              />
            </div>
            <div className={styles.vesteeInputContainer}>
              <label>Vestee End Timestamp</label>
              <DatePicker
                value={vesteeEndTimestamp}
                onChange={setVesteeEndTimestamp}
              />
            </div>
            <div className={styles.vesteeButtons}>
              <button onClick={() => addVestee()}>Add Vestee</button>
              <button onClick={() => updateVestee()}>Update Vestee</button>
              <button onClick={() => removeVestee()}>Remove Vestee</button>
            </div>
            <button onClick={() => vest()}>Vest</button>
          </div>
          <div className={styles.insideContainer}>
            <p>Instance Addresses</p>
            {instanceAddresses.length === 0 &&
              !ethers.utils.isAddress(instanceAddress) && (
                <div>
                  You haven't set up any vesting contracts yet, follow the steps
                  above, it's as easy as 1, 2, 3. 😉
                </div>
              )}
            <p>
              You can also input the address of a vesting contract instance
              below to see some details of it:
            </p>
            <input
              value={instanceAddress}
              onChange={(e) => setInstanceAddress(e.target.value)}
            />
            <ul>
              {instanceAddresses.map((x) => (
                <li
                  key={x}
                  className={styles.anchor}
                  onClick={() => setInstanceAddress(x)}
                >
                  {x}
                </li>
              ))}
            </ul>
            {instanceAddress && instanceDetails && (
              <>
                <p>Vesting Contract Details</p>
                <p>Vesting Contract Instance Address: {instanceAddress}</p>
                <p>Vested Token Name: {instanceDetails.tokenName}</p>
                <p>Vested Token Symbol: {instanceDetails.tokenSymbol}</p>
                <p>Vestee: {instanceDetails.vestee}</p>
                <p>
                  Flow Rate:{" "}
                  {ethers.utils.formatUnits(
                    instanceDetails.flowingBalanceDetails.flowRate || "0"
                  )}{" "}
                  {instanceDetails.tokenSymbol}
                  /s
                </p>
                <p>Current Date: {time.toLocaleDateString()}</p>
                <p>
                  Vestee End Date:{" "}
                  {instanceDetails.vestingEndDate.toLocaleDateString() +
                    " " +
                    instanceDetails.vestingEndDate.toLocaleTimeString()}
                </p>
                <p>Total To Be Vested: {instanceDetails.amountToVest}</p>
                <p>
                  Remaining:{" "}
                  {ethers.utils.formatUnits(remainingVestAmount.toString())}
                </p>
              </>
            )}
            <button onClick={() => stopVesting()}>Stop Vesting</button>
          </div>
        </div>
      </main>
      <footer className={styles.footer}>
        <a href="https://rainbow.me" target="_blank" rel="noopener noreferrer">
          Built with 🌊 by your frens at Superfluid
        </a>
      </footer>
    </div>
  );
};

export default Home;
