import { ethers, formatUnits, parseEther, parseUnits } from "ethers";
import dotenv from "dotenv";
import { JsonRpcProvider } from "ethers";
import axios from "axios";
import { publicClient } from "./utils/network";
dotenv.config(); // Load environment variables from .env file
import ERC20Abi from "./utils/ABI/ERC20Abi.json";
import SelfDestructAbi from "./utils/ABI/SelfDestruct.json";

import { ContractFactory } from "ethers";

// Load environment variables
const MAINNET_RPC = process.env.MAINNET_RPC as string;
const BUILDBEAR_RPC = process.env.BUILDBEAR_RPC as string;
const PAIR_ADDRESS = process.env.PAIR_ADDRESS as `0x${string}`;
const TOKEN0 = process.env.TOKEN0 as `0x${string}`;
const TOKEN1 = process.env.TOKEN1 as `0x${string}`;
const FUNDER_ADDRESS = process.env.FUNDER_ADDRESS as `0x${string}`;
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;

const UNISWAP_V2_PAIR_ABI = [
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data)",
  "function transfer(address to, uint amount) returns (bool)",
  "function sync()",
  "function skim(address to)",
];

// Connect to networks
const mainnetProvider: JsonRpcProvider = new ethers.JsonRpcProvider(
  MAINNET_RPC
);
const sandboxProvider: JsonRpcProvider = new ethers.JsonRpcProvider(
  BUILDBEAR_RPC
);

const wallet = new ethers.Wallet(PRIVATE_KEY, sandboxProvider);

// Impersonation signer (for sandbox)
const getImpersonatedSigner = async (address: `0x${string}`) => {
  await sandboxProvider.send("hardhat_impersonateAccount", [address]);
  return sandboxProvider.getSigner(address);
};

// Fetch reserves from Uniswap V2 pair
const getReserves = async (
  provider: JsonRpcProvider,
  address: `0x${string}`
) => {
  const pair = new ethers.Contract(address, UNISWAP_V2_PAIR_ABI, provider);
  const [reserve0, reserve1] = await pair.getReserves();
  return { reserve0, reserve1 };
};

// Fund sandbox using BuildBear faucet
const fundSandbox = async (
  address: string,
  amount: string,
  token?: `0x${string}`
) => {
  try {
    if (token) {
      console.log(
        `${token} Balance Before : ${await getTokenBalanceForAccount(
          token,
          address as `0x${string}`
        )}`
      );
    } else {
      console.log(
        `Native Balance Before : ${await getNativeBalanceForAccount(
          address as `0x${string}`
        )}`
      );
    }

    // if (token)
    //   amount = formatUnits(parseEther(amount), await getTokenDecimals(token));
    console.log(
      `🚰 Requesting BuildBear faucet for ${amount} wei of ${
        token || "Native Token"
      }...`
    );

    const method = token ? "buildbear_ERC20Faucet" : "buildbear_nativeFaucet";
    const params = token
      ? [
          {
            address,
            balance: amount.toString(),
            token,
            unit: "wei",
          },
        ]
      : [{ address, balance: amount.toString(), unit: "wei" }];
    // console.log("=========== 🐞Debugging =========== ");
    // console.log(`params\n`, params);
    // console.log(`method\n`, method);

    // console.log("===================================");

    const response = await axios.post(BUILDBEAR_RPC, {
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    });

    if (response.data.error) {
      console.error(`❌ Faucet Error: ${response.data}`);
      console.error("Faucet response:", response.data); // Add this for debugging
    } else {
      if (token) {
        console.log(
          `✅ Faucet Success: Funded ${formatUnits(
            BigInt(amount),
            await getTokenDecimals(token)
          )} ${token} to ${address}`
        );
        console.log(
          `${token} Balance After : ${await getTokenBalanceForAccount(
            token,
            address as `0x${string}`
          )}`
        );
      } else {
        console.log(
          `✅ Faucet Success: Funded ${formatUnits(
            BigInt(amount),
            18
          )} Native to ${address}`
        );
        console.log(
          `Native Balance After : ${await getNativeBalanceForAccount(
            address as `0x${string}`
          )}`
        );
      }
    }
  } catch (error) {
    console.error(error);
    console.error(`❌ Error funding sandbox pair: ${error.message}`);
  }
};

// Burn excess tokens by sending to 0xdead
const burnExcessTokens = async (
  pairAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
  amount: string
) => {
  // amount = parseUnits(amount, await getTokenDecimals(tokenAddress)).toString();
  // console.log(
  //   `🔥 Burning excess tokens (${amount}) of ${tokenAddress} from ${pairAddress}`
  // );

  // Impersonate the Uniswap V2 Pair contract
  const signer = await getImpersonatedSigner(pairAddress);

  //   console.log("====================================");
  //   console.log(`⚠️ Impersonating Signer: ${signer.address}`);
  //   console.log("====================================");
  const currentBalance = await getTokenBalanceForAccount(
    tokenAddress,
    pairAddress as `0x${string}`
  );
  //   console.log("====================================");
  //   console.log(
  //     `⚠️ Balance of ${tokenAddress} for Signer ${signer.address} : ${currentBalance}`
  //   );
  //   console.log("====================================");

  // ERC20 Token Contract Instance
  const tokenContract = new ethers.Contract(tokenAddress, ERC20Abi, signer);

  // Send tokens to dead address (burn)
  const approveTx = await tokenContract.approve(
    "0x000000000000000000000000000000000000dEaD",
    amount
  );

  const transferTx = await tokenContract.transfer(
    "0x000000000000000000000000000000000000dEaD",
    amount
  );

  console.log(`✅ Burned ${amount} ${tokenAddress} tokens`);
};

// Adjust sandbox reserves
const syncV2Reserves = async () => {
  if (!PAIR_ADDRESS) {
    console.error("❌ Pair address not provided.");
    process.exit(0);
  }

  console.log("🔄 Fetching reserves from mainnet and sandbox...");
  const { mainnetReserves, sandboxReserves } =
    await getMainnetAndSandboxStates();
  console.log("✅ Mainnet Reserves");
  console.log(
    `${await getTokenName(TOKEN0)} : `,
    formatUnits(mainnetReserves.reserve0, await getTokenDecimals(TOKEN0))
  );
  console.log(
    ` ${await getTokenName(TOKEN1)} : `,
    formatUnits(mainnetReserves.reserve1, await getTokenDecimals(TOKEN1))
  );

  console.log("✅ Sandbox Reserves");
  console.log(
    `${await getTokenName(TOKEN0)} : `,
    formatUnits(sandboxReserves.reserve0, await getTokenDecimals(TOKEN0))
  );
  console.log(
    ` ${await getTokenName(TOKEN1)} : `,
    formatUnits(sandboxReserves.reserve1, await getTokenDecimals(TOKEN1))
  );
  const sandboxSigner = await getImpersonatedSigner(PAIR_ADDRESS);
  const pairContract = new ethers.Contract(
    PAIR_ADDRESS,
    UNISWAP_V2_PAIR_ABI,
    sandboxSigner
  );

  // Calculate reserve differences
  let missingToken0 =
    mainnetReserves.reserve0 > sandboxReserves.reserve0
      ? mainnetReserves.reserve0 - sandboxReserves.reserve0
      : 0;
  let missingToken1 =
    mainnetReserves.reserve1 > sandboxReserves.reserve1
      ? mainnetReserves.reserve1 - sandboxReserves.reserve1
      : 0;

  let excessToken0 =
    sandboxReserves.reserve0 > mainnetReserves.reserve0
      ? sandboxReserves.reserve0 - mainnetReserves.reserve0
      : 0;
  let excessToken1 =
    sandboxReserves.reserve1 > mainnetReserves.reserve1
      ? sandboxReserves.reserve1 - mainnetReserves.reserve1
      : 0;

  // Add check to exit if no changes are needed
  if (
    missingToken0 === 0 &&
    missingToken1 === 0 &&
    excessToken0 === 0 &&
    excessToken1 === 0
  ) {
    console.log(
      "✅ No changes needed! Sandbox reserves match mainnet reserves."
    );
    return; // Exit the function
  }

  console.log(`Token0 : ${TOKEN0}`);
  console.log(`Token1 : ${TOKEN1}`);

  console.log(`RAW :: missingToken0 : ${missingToken0}`);
  console.log(`RAW :: missingToken1 : ${missingToken1}`);
  console.log(`RAW :: excessToken0 : ${excessToken0}`);
  console.log(`RAW :: excessToken1 : ${excessToken1}`);

  // 🔹 FUND SANDBOX IF RESERVES ARE LOWER THAN MAINNET
  if (missingToken1 > 0) {
    console.log(
      `⚠️ ${TOKEN1} Sandbox reserves are lower than mainnet! Minting additional tokens...`
    );
    console.log(
      `🚰 Funding Sandbox: Minting ${formatUnits(
        missingToken1,
        await getTokenDecimals(TOKEN1)
      )} of Token1 (${TOKEN1})`
    );
    await fundSandbox(PAIR_ADDRESS, missingToken1.toString(), TOKEN1);
  }

  if (missingToken0 > 0) {
    console.log(
      `⚠️ ${TOKEN0} Sandbox reserves are lower than mainnet! Minting additional tokens...`
    );
    console.log(
      `🚰 Funding Sandbox: Minting ${formatUnits(
        missingToken0,
        await getTokenDecimals(TOKEN0)
      )} of Token0 (${TOKEN0})`
    );
    await fundSandbox(PAIR_ADDRESS, missingToken0.toString(), TOKEN0);
  }

  // 🔹 BURN EXCESS TOKENS IF RESERVES ARE HIGHER THAN MAINNET
  if (excessToken1 > 0) {
    console.log(
      `⚠️ ${TOKEN1} Sandbox reserves are higher than mainnet! Burning excess tokens...`
    );
    console.log(
      `🔥 Burning ${formatUnits(
        excessToken1,
        await getTokenDecimals(TOKEN1)
      )} of Token1 (${TOKEN1})`
    );
    await burnExcessTokens(PAIR_ADDRESS, TOKEN1, excessToken1.toString());
  }

  if (excessToken0 > 0) {
    console.log(
      `⚠️ ${TOKEN0} Sandbox reserves are higher than mainnet! Burning excess tokens...`
    );
    console.log(
      `🔥 Burning ${formatUnits(
        excessToken0,
        await getTokenDecimals(TOKEN0)
      )} of Token0 (${TOKEN0})`
    );
    await burnExcessTokens(PAIR_ADDRESS, TOKEN0, excessToken0.toString());
  }

  // Perform sync to finalize state update
  console.log("🔄 Performing sync() update the state...");
  try {
    await pairContract.sync();
    console.log("✅ Pair state updated successfully with sync()");
  } catch (error) {
    console.error(`❌ Error calling sync(): ${error.message}`);
    console.log("⚠️ Attempting to use skim() as fallback...");
    try {
      await pairContract.skim(FUNDER_ADDRESS);
      console.log("✅ Pair state updated successfully with skim()");
    } catch (innerError) {
      console.error(`❌ Error calling skim(): ${innerError.message}`);
    }
  }

  console.log("✅ Reserves adjusted successfully.");
  console.log("🔄 Fetching new reserves from mainnet and sandbox...");
  const { sandboxReserves: sandboxReservesNew } =
    await getMainnetAndSandboxStates();
  console.log("✅ Mainnet Reserves");
  console.log(
    `${await getTokenName(TOKEN0)} : `,
    formatUnits(mainnetReserves.reserve0, await getTokenDecimals(TOKEN0))
  );
  console.log(
    `${await getTokenName(TOKEN1)} : `,
    formatUnits(mainnetReserves.reserve1, await getTokenDecimals(TOKEN1))
  );

  console.log("✅ Updated Sandbox Reserves");
  console.log(
    `${await getTokenName(TOKEN0)} : `,
    formatUnits(sandboxReservesNew.reserve0, await getTokenDecimals(TOKEN0))
  );
  console.log(
    `${await getTokenName(TOKEN1)} : `,
    formatUnits(sandboxReservesNew.reserve1, await getTokenDecimals(TOKEN1))
  );

  console.assert(
    sandboxReservesNew.reserve0 == mainnetReserves.reserve0 &&
      sandboxReservesNew.reserve1 == mainnetReserves.reserve1,
    "❌ Failed to sync mainnet and sandbox reserves"
  );
};

// -------------- MAIN SCRIPT --------------
try {
  let nativeFundsForPair = await getNativeBalanceForAccount(PAIR_ADDRESS);
  if (+nativeFundsForPair <= 0) {
    console.log("====================================");
    console.log("🟠 Getting Native Funds on Pair Address");
    console.log("====================================");
    await deploySelfDestructContract(parseEther("1000000").toString());
  }
  await syncV2Reserves();
} catch (error) {
  console.error(`❌ Error adjusting reserves:\n`);
  console.error(error);
}

/// -------- Test Functionalities ------------

// await fundSandbox(FUNDER_ADDRESS, parseEther("1000").toString());

// console.log(
//   "USDC Balance Before ",
//   await getTokenBalanceForAccount(TOKEN0, FUNDER_ADDRESS)
// );
// await fundSandbox(
//   FUNDER_ADDRESS,
//   parseUnits("1", await getTokenDecimals(TOKEN0)),
//   TOKEN0
// );
// console.log(
//   "USDC Balance After ",
//   await getTokenBalanceForAccount(TOKEN0, FUNDER_ADDRESS)
// );

// console.log(
//   "WETH Balance Before ",
//   await getTokenBalanceForAccount(TOKEN1, FUNDER_ADDRESS)
// );
// await fundSandbox(
//   FUNDER_ADDRESS,
//   parseUnits("1", await getTokenDecimals(TOKEN1)),
//   TOKEN1
// );
// console.log(
//   "WETH Balance After ",
//   await getTokenBalanceForAccount(TOKEN1, FUNDER_ADDRESS)
// );

// await burnExcessTokens(PAIR_ADDRESS, TOKEN1, "1000");
// get WETH Balance of Account
async function getTokenBalanceForAccount(
  tokenAddress: `0x${string}`,
  account: `0x${string}`
): Promise<string> {
  let res = await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20Abi,
    functionName: "balanceOf",
    args: [account],
  });
  return formatUnits(
    res as bigint,
    await getTokenDecimals(tokenAddress)
  ).toString();
}

async function getNativeBalanceForAccount(account: `0x${string}`) {
  let res = await publicClient.getBalance({
    address: account,
  });
  return res.toString();
}

async function getTokenName(tokenAddress: `0x${string}`): Promise<string> {
  let res = await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20Abi,
    functionName: "name",
  });
  return res as string;
}

async function getTokenDecimals(tokenAddress: `0x${string}`): Promise<number> {
  let res = await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20Abi,
    functionName: "decimals",
  });
  return res as number;
}

async function deploySelfDestructContract(initialFunds: string) {
  await fundSandbox(FUNDER_ADDRESS, initialFunds);

  console.log("====================================");
  console.log(
    `🟠 Deploying Self Destruct Contract from wallet : ${wallet.address}`
  );
  console.log("====================================");
  // Bytecode for a contract that can self-destruct
  const bytecode =
    "60806040526040516100ba3803806100ba8339818101604052810190602391906093565b8073ffffffffffffffffffffffffffffffffffffffff16ff5b5f80fd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f6067826040565b9050919050565b607581605f565b8114607e575f80fd5b50565b5f81519050608d81606e565b92915050565b5f6020828403121560a55760a4603c565b5b5f60b0848285016081565b9150509291505056fe";

  console.log(
    `🚀 Deploying contract with ${ethers.formatEther(initialFunds)} ETH...`
  );

  const factory = new ContractFactory(SelfDestructAbi, bytecode, wallet);

  // If your contract requires constructor args, you can specify them here
  const contract = await factory.deploy(PAIR_ADDRESS, {
    value: initialFunds,
  });

  await contract.waitForDeployment();
  console.log(await contract.deploymentTransaction());

  console.log(`✅ Contract deployed at: ${await contract.getAddress()}`);
}

async function getMainnetAndSandboxStates() {
  const mainnetReserves = await getReserves(mainnetProvider, PAIR_ADDRESS);
  const sandboxReserves = await getReserves(sandboxProvider, PAIR_ADDRESS);

  return { mainnetReserves, sandboxReserves };
}
