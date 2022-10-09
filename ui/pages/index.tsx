import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ContractReceipt, ethers } from "ethers";
import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import styles from "../styles/Home.module.css";
import DatePicker from "react-date-picker/dist/entry.nostyle";
import {
  SuperfluidVestooorFactory,
  SuperfluidVestooorFactoryCreator,
  SuperfluidVestooorFactoryCreator__factory,
  SuperfluidVestooorFactory__factory,
  SuperfluidVestooor__factory,
} from "../typechain-types";
import { useAccount, useProvider, useSigner } from "wagmi";
import {
  ERC20Token,
  Framework,
  WrapperSuperToken,
} from "@superfluid-finance/sdk-core";
import { IFrameworkOptions } from "@superfluid-finance/sdk-core/dist/module/Framework";
import { getInstanceAddresses, getTotalFlowedBalance } from "../utils/utils";
import {
  Balance,
  FlowingBalanceDetails,
  UserSuperTokenInfo,
  TokenFactoryInfo,
  VestingInstanceDetails,
} from "../interfaces/interfaces";
import { Input } from "../components/Input";

const DEFAULT_VESTING_INSTANCE_DETAILS = {
  vestee: "",
  amountToVest: "",
  vestingEndDate: new Date(),
  tokenSymbol: "",
  tokenName: "",
  flowingBalanceDetails: { balance: 0, balanceTimestamp: 0, flowRate: "" },
};

// @note This is the "pseudo-official factory creator address"
// please only change this if you understand the full implications
// https://goerli.etherscan.io/address/0x286ad03ea8a79dbca8ae17d0b0c2cf9e62e04e56
const GOERLI_VESTOOOR_FACTORY_CREATOR_ADDRESS =
  "0x286aD03EA8a79dBCA8AE17d0b0C2Cf9E62e04e56";

const Home: NextPage = () => {
  const [loading, setLoading] = useState(true);
  const [totalVestAmount, setTotalVestAmount] = useState("");
  const [selectedTokenAddress, setSelectedTokenAddress] = useState("");
  const [selectedVesteeAddress, setSelectedVesteeAddress] = useState("");
  const [framework, setFramework] = useState<Framework>();
  const [underlyingToken, setUnderlyingToken] = useState<ERC20Token>();
  const [tokenInfo, setTokenInfo] = useState<UserSuperTokenInfo>();
  const [instanceAddresses, setInstanceAddresses] = useState<string[]>([]);
  const [factoryContract, setFactoryContract] =
    useState<SuperfluidVestooorFactory>();
  const [requiresFactoryCreation, setRequiresFactoryCreation] = useState(true);
  const [factoryCreatorContract, setFactoryCreatorContract] =
    useState<SuperfluidVestooorFactoryCreator>();
  const [
    tokenAddressToTokenFactoryInfoMap,
    setTokenAddressToTokenFactoryInfoMap,
  ] = useState<Map<string, TokenFactoryInfo>>(new Map());
  const [vestees, setVestees] = useState<
    SuperfluidVestooorFactory.VesteeStruct[]
  >([]);
  const [time, setTime] = useState(new Date());
  const [vesteeAddress, setVesteeAddress] = useState("");
  const [vesteeAmountToVest, setVesteeAmountToVest] = useState("");
  const [vesteeEndTimestamp, setVesteeEndTimestamp] = useState(new Date());

  const [instanceAddress, setInstanceAddress] = useState("");
  const [instanceDetails, setInstanceDetails] =
    useState<VestingInstanceDetails>(DEFAULT_VESTING_INSTANCE_DETAILS);

  // wagmi hooks
  const provider = useProvider();
  const { data: signer } = useSigner();
  const account = useAccount();

  // memoized variables
  const remainingVestAmount = useMemo(() => {
    const totalFlowedData: Balance = {
      balance: instanceDetails.flowingBalanceDetails.balance,
      timestamp: instanceDetails.flowingBalanceDetails.balanceTimestamp,
    };

    return getTotalFlowedBalance(
      totalFlowedData,
      instanceDetails.flowingBalanceDetails.flowRate,
      time
    );
  }, [
    time,
    instanceDetails.flowingBalanceDetails.balance,
    instanceDetails.flowingBalanceDetails.balanceTimestamp,
    instanceDetails.flowingBalanceDetails.flowRate,
  ]);

  // helper functions
  const createVestooorFactoryTxn = async () => {
    if (factoryCreatorContract && selectedTokenAddress) {
      await factoryCreatorContract.createFactory(selectedTokenAddress);
      setRequiresFactoryCreation(false);
    }
  };

  const approveTxn = async () => {
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

  const vestTxn = async () => {
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

  const stopVestingTxn = async () => {
    if (!signer) return;

    const superfluidVestooor = SuperfluidVestooor__factory.connect(
      instanceAddress,
      signer
    );

    await superfluidVestooor.stopVesting();
  };

  const dateToSecondsTimestamp = (date: Date) =>
    Math.round(date.getTime() / 1000);

  const addVestee = async () => {
    const newVestee: SuperfluidVestooorFactory.VesteeStruct = {
      vesteeAddress,
      amountToVest: ethers.utils.parseUnits(vesteeAmountToVest),
      vestingEndTimestamp: dateToSecondsTimestamp(vesteeEndTimestamp),
    };
    setVestees([...vestees, newVestee]);
  };

  const updateVestee = async () => {
    const index = vestees
      .map((x) => x.vesteeAddress)
      .indexOf(selectedVesteeAddress);
    const newVestee: SuperfluidVestooorFactory.VesteeStruct = {
      vesteeAddress: selectedVesteeAddress,
      amountToVest: vesteeAmountToVest,
      vestingEndTimestamp: dateToSecondsTimestamp(vesteeEndTimestamp),
    };
    const newVestees = [
      ...vestees.slice(0, index),
      newVestee,
      ...vestees.slice(index),
    ];

    if (index >= 0) {
      setVestees(newVestees);
    }
  };

  const removeVestee = async () => {
    setVestees(
      vestees.filter((x) => x.vesteeAddress !== selectedVesteeAddress)
    );
  };

  const _loadTokenInfo = async (
    superToken: WrapperSuperToken,
    factoryAddress: string
  ) => {
    if (account.address) {
      const userBalance = await superToken.balanceOf({
        account: account.address,
        providerOrSigner: provider,
      });
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
        underlyingBalance: ethers.utils.formatUnits(underlyingBalance),
        availableToVest: ethers.utils.formatUnits(approvedAmount),
      });
      setUnderlyingToken(superToken.underlyingToken);
    }
  };

  /** UseEffect Hooks */

  // initialize the time variable
  useEffect(() => {
    (async () => {
      const block = await provider.getBlock("latest");
      setTime(new Date(block.timestamp * 1000));
    })();
  }, []);

  // update time every second with setTimeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setTime(new Date(time.getTime() + 1000));
    }, 1000);

    return () => clearTimeout(timer);
  });

  // Framework initialization hook
  useEffect(() => {
    (async () => {
      const baseObject = {
        chainId: provider.network.chainId,
        provider,
        protocolReleaseVersion: process.env.IS_DEV ? "test" : "v1",
      };
      const frameworkOptions: IFrameworkOptions = process.env.IS_DEV
        ? {
            ...baseObject,
            resolverAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
          }
        : {
            ...baseObject,
          };
      const sfFramework = await Framework.create(frameworkOptions);
      setFramework(sfFramework);
    })();
  }, []);

  // get the factory creator contract
  useEffect(() => {
    if (signer) {
      setFactoryCreatorContract(
        SuperfluidVestooorFactoryCreator__factory.connect(
          GOERLI_VESTOOOR_FACTORY_CREATOR_ADDRESS,
          signer
        )
      );
    }
  }, [signer]);

  // handles initial loading of listed super tokens
  useEffect(() => {
    (async () => {
      if (framework && factoryCreatorContract) {
        const tokenAddrToTokenFactoryInfoMap: Map<string, TokenFactoryInfo> =
          new Map();
        // get listed super tokens
        const rawListedSuperTokens = await framework.query.listAllSuperTokens({
          isListed: true,
        });

        const listedWrapperSuperTokens = rawListedSuperTokens.data.filter(
          (x) => x.underlyingAddress !== ethers.constants.AddressZero
        );

        // get the computed factories with the creator and create a mapping of token address
        // to factory address and some other details
        for (let i = 0; i < listedWrapperSuperTokens.length; i++) {
          const tokenAddress = listedWrapperSuperTokens[i].id;
          const deterministicFactoryAddress =
            await factoryCreatorContract.computeAddress(tokenAddress);
          tokenAddrToTokenFactoryInfoMap.set(tokenAddress, {
            factory: deterministicFactoryAddress,
            symbol: listedWrapperSuperTokens[i].symbol,
            name: listedWrapperSuperTokens[i].name,
          });
        }
        setTokenAddressToTokenFactoryInfoMap(tokenAddrToTokenFactoryInfoMap);
        setLoading(false);
      }
    })();
  }, [framework, factoryCreatorContract]);

  // handles selection of a token
  useEffect(() => {
    (async () => {
      if (framework && selectedTokenAddress) {
        const factoryAddress =
          tokenAddressToTokenFactoryInfoMap.get(selectedTokenAddress)?.factory;
        if (factoryAddress) {
          (async () => {
            const code = await provider.getCode(factoryAddress);
            setFactoryContract(
              SuperfluidVestooorFactory__factory.connect(
                factoryAddress,
                provider
              )
            );

            if (code !== "0x") {
              setRequiresFactoryCreation(false);
            } else {
              setRequiresFactoryCreation(true);
            }
          })();
        }
      }
    })();
  }, [framework, selectedTokenAddress]);

  useEffect(() => {
    const factoryAddress =
      tokenAddressToTokenFactoryInfoMap.get(selectedTokenAddress)?.factory;
    if (framework && requiresFactoryCreation === false && factoryAddress) {
      (async () => {
        const superToken = await framework.loadWrapperSuperToken(
          selectedTokenAddress
        );
        await _loadTokenInfo(superToken, factoryAddress);
      })();
    }
  }, [requiresFactoryCreation]);

  // load from local storage
  useEffect(() => {
    const instanceAddresses =
      localStorage.getItem("INSTANCE_ADDRESSES") || "[]";
    setInstanceAddresses(JSON.parse(instanceAddresses));
  }, []);

  // load instance details
  useEffect(() => {
    if (instanceAddress && framework) {
      const superfluidVestooor = SuperfluidVestooor__factory.connect(
        instanceAddress,
        provider
      );
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

        const vestFlowData = await vestedToken.getFlow({
          sender: instanceAddress,
          receiver: vestee,
          providerOrSigner: provider,
        });
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
            <label style={{ fontWeight: "bold" }} htmlFor="tokenToVest">
              1. Token to Vest
            </label>
            <select onChange={(x) => setSelectedTokenAddress(x.target.value)}>
              <option value="">
                {" "}
                {loading &&
                Array.from(tokenAddressToTokenFactoryInfoMap).length === 0
                  ? "loading..."
                  : "-- select a token --"}{" "}
              </option>
              {Array.from(tokenAddressToTokenFactoryInfoMap).map((x) => (
                <option key={x[0]} value={x[0]}>
                  {x[1].symbol} - {x[1].name}
                </option>
              ))}
            </select>

            {tokenAddressToTokenFactoryInfoMap.get(selectedTokenAddress) && (
              <p>
                Factory Address:{" "}
                {
                  tokenAddressToTokenFactoryInfoMap.get(selectedTokenAddress)!
                    .factory
                }
              </p>
            )}
            {requiresFactoryCreation === true && factoryContract != null && (
              <>
                <div>
                  <p style={{ maxWidth: "85%" }}>
                    Oh no, it looks like a vestooor factory contract is not
                    deployed for this token yet. Please deploy one if you'd like
                    to vest.
                  </p>
                  <button onClick={() => createVestooorFactoryTxn()}>
                    Deploy{" "}
                    {
                      tokenAddressToTokenFactoryInfoMap.get(
                        selectedTokenAddress
                      )?.name
                    }{" "}
                    Vestooor Factory Contract
                  </button>
                </div>
              </>
            )}
            {(requiresFactoryCreation === false && factoryContract == null) ||
              (requiresFactoryCreation === false && (
                <>
                  <p>Token Info</p>
                  <p>
                    Name:{" "}
                    {
                      tokenAddressToTokenFactoryInfoMap.get(
                        selectedTokenAddress
                      )?.name
                    }
                  </p>
                  <p>
                    Symbol:{" "}
                    {
                      tokenAddressToTokenFactoryInfoMap.get(
                        selectedTokenAddress
                      )?.symbol
                    }
                  </p>
                  <p>Super Token Balance: {tokenInfo?.userBalance}</p>
                  <p>
                    Underlying Token Balance: {tokenInfo?.underlyingBalance}
                  </p>
                  <p>
                    Approved Underlying Amount To Vest:{" "}
                    {tokenInfo?.availableToVest}
                  </p>
                  <Input
                    label="Total Vest Amount"
                    name="totalVestAmount"
                    placeholder="e.g. 42069"
                    value={totalVestAmount}
                    onChange={(e) => setTotalVestAmount(e)}
                  />
                  <p>
                    This is the total amount you want to vest for your
                    vestee(s).
                  </p>
                  <button onClick={() => approveTxn()}>
                    Approve Vesting Contract
                  </button>
                </>
              ))}
          </div>
          <div className={styles.insideContainer}>
            <p style={{ fontWeight: "bold" }}>2. Add Vestee(s)</p>
            <p>Vestee(s)</p>
            <select
              className={styles.selectVestee}
              size={5}
              onChange={(e) => setSelectedVesteeAddress(e.target.value)}
            >
              {vestees.map((x) => (
                <option
                  key={x.vesteeAddress as string}
                  value={x.vesteeAddress as string}
                >
                  {x.vesteeAddress as string}
                </option>
              ))}
            </select>
            <Input
              label="Vestee Address"
              name="vesteeAddress"
              placeholder="e.g. 0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
              value={vesteeAddress}
              onChange={(e) => setVesteeAddress(e)}
            />
            <Input
              label="Vestee Vest Amount"
              name="vesteeVestAmount"
              placeholder="e.g. 33"
              value={vesteeAmountToVest}
              onChange={(e) => setVesteeAmountToVest(e)}
            />
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
            <p style={{ fontWeight: "bold", paddingRight: "0.5rem" }}>
              3. Profit
            </p>
            <button onClick={() => vestTxn()}>Vest</button>
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
              placeholder="e.g. 0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
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
            {instanceAddress && (
              <button onClick={() => stopVestingTxn()}>Stop Vesting</button>
            )}
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
