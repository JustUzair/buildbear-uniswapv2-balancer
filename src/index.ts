import {
  ethers,
  formatUnits,
  parseEther,
  parseUnits,
  ZeroAddress,
} from "ethers";
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

    if (token)
      amount = formatUnits(parseEther(amount), await getTokenDecimals(token));
    console.log(
      `🚰 Requesting BuildBear faucet for ${amount} of ${
        token || "Native Token"
      }...`
    );

    const method = token ? "buildbear_ERC20Faucet" : "buildbear_nativeFaucet";
    const params = token
      ? [{ address, balance: amount, token }]
      : [{ address, balance: amount }];

    const response = await axios.post(BUILDBEAR_RPC, {
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    });

    if (response.data.error) {
      console.error(`❌ Faucet Error: ${response.data.error.message}`);
      console.error("Faucet response:", response.data); // Add this for debugging
    } else {
      console.log(
        `✅ Faucet Success: Funded ${amount} ${
          token || "Native Token"
        } to ${address}`
      );
      if (token) {
        console.log(
          `${token} Balance After : ${await getTokenBalanceForAccount(
            token,
            address as `0x${string}`
          )}`
        );
      } else {
        console.log(
          `Native Balance After : ${await getNativeBalanceForAccount(
            address as `0x${string}`
          )}`
        );
      }
    }
  } catch (error) {
    console.error(`❌ Error funding sandbox pair: ${error.message}`);
  }
};

// Burn excess tokens by sending to 0xdead
const burnExcessTokens = async (
  pairAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
  amount: string
) => {
  let nativeFundsForPair = await getNativeBalanceForAccount(pairAddress);
  if (+nativeFundsForPair <= 0) {
    console.log("====================================");
    console.log("🟠 Getting Native Funds on Pair Address");
    console.log("====================================");
    deploySelfDestructContract(parseEther("1000000").toString());
  }

  amount = parseUnits(amount, await getTokenDecimals(tokenAddress)).toString();
  console.log(
    `🔥 Burning excess tokens (${amount}) of ${tokenAddress} from ${pairAddress}`
  );

  // Impersonate the Uniswap V2 Pair contract
  await sandboxProvider.send("hardhat_impersonateAccount", [pairAddress]);
  const signer = await getImpersonatedSigner(pairAddress);

  console.log("====================================");
  console.log(`⚠️ Impersonating Signer: ${signer.address}`);
  console.log("====================================");

  console.log("====================================");
  console.log(
    `⚠️ Balance of ${tokenAddress} for Signer ${
      signer.address
    } : ${await getTokenBalanceForAccount(
      tokenAddress,
      signer.address as `0x${string}`
    )}`
  );
  console.log("====================================");

  // ERC20 Token Contract Instance
  const tokenContract = new ethers.Contract(tokenAddress, ERC20Abi, signer);

  // console.log("====================================");
  // console.log(`⚠️ Token Contract: ${tokenContract.target}`);
  // console.log("====================================");

  // // Send tokens to dead address (burn)
  const approveTx = await tokenContract.approve(
    "0x000000000000000000000000000000000000dEaD",
    amount
  );
  await approveTx.wait();

  const transferTx = await tokenContract.transferFrom(
    PAIR_ADDRESS,
    "0x000000000000000000000000000000000000dEaD",
    amount
  );

  await transferTx.wait();
  console.log(
    `✅ Burned ${amount} ${tokenAddress} tokens. Tx Hash: ${transferTx.hash}`
  );
};

// Adjust sandbox reserves
const adjustReserves = async () => {
  if (!PAIR_ADDRESS) {
    console.error("❌ Pair address not provided.");
    process.exit(0);
  }

  console.log("🔄 Fetching reserves from mainnet and sandbox...");
  const mainnetReserves = await getReserves(mainnetProvider, PAIR_ADDRESS);
  const sandboxReserves = await getReserves(sandboxProvider, PAIR_ADDRESS);

  console.log("✅ Mainnet Reserves:", mainnetReserves);
  console.log("✅ Sandbox Reserves:", sandboxReserves);

  const delta0 = mainnetReserves.reserve0 - sandboxReserves.reserve0;
  const delta1 = mainnetReserves.reserve1 - sandboxReserves.reserve1;

  const sandboxSigner = await getImpersonatedSigner(PAIR_ADDRESS);
  const pairContract = new ethers.Contract(
    PAIR_ADDRESS,
    UNISWAP_V2_PAIR_ABI,
    sandboxSigner
  );

  // Calculate reserve differences
  const missingToken0 =
    mainnetReserves.reserve0 > sandboxReserves.reserve0
      ? mainnetReserves.reserve0 - sandboxReserves.reserve0
      : 0;
  const missingToken1 =
    mainnetReserves.reserve1 > sandboxReserves.reserve1
      ? mainnetReserves.reserve1 - sandboxReserves.reserve1
      : 0;

  const excessToken0 =
    sandboxReserves.reserve0 > mainnetReserves.reserve0
      ? sandboxReserves.reserve0 - mainnetReserves.reserve0
      : 0;
  const excessToken1 =
    sandboxReserves.reserve1 > mainnetReserves.reserve1
      ? sandboxReserves.reserve1 - mainnetReserves.reserve1
      : 0;

  // 🔹 FUND SANDBOX IF RESERVES ARE LOWER THAN MAINNET
  if (missingToken0 > 0 || missingToken1 > 0) {
    console.log(
      `⚠️ Sandbox reserves are lower than mainnet! Minting additional tokens...`
    );

    if (missingToken0 > 0) {
      console.log(
        `🚰 Funding Sandbox: Minting ${missingToken0} of Token0 (${TOKEN0})`
      );
      await fundSandbox(PAIR_ADDRESS, missingToken0.toString(), TOKEN0);
    }
    if (missingToken1 > 0) {
      console.log(
        `🚰 Funding Sandbox: Minting ${missingToken1} of Token1 (${TOKEN1})`
      );
      await fundSandbox(PAIR_ADDRESS, missingToken1.toString(), TOKEN1);
    }
  }

  // 🔹 BURN EXCESS TOKENS IF RESERVES ARE HIGHER THAN MAINNET
  if (excessToken0 > 0 || excessToken1 > 0) {
    console.log(
      `⚠️ Sandbox reserves are higher than mainnet! Burning excess tokens...`
    );

    if (excessToken0 > 0) {
      console.log(`🔥 Burning ${excessToken0} of Token0 (${TOKEN0})`);
      await burnExcessTokens(PAIR_ADDRESS, TOKEN0, excessToken0.toString());
    }
    if (excessToken1 > 0) {
      console.log(`🔥 Burning ${excessToken1} of Token1 (${TOKEN1})`);
      await burnExcessTokens(PAIR_ADDRESS, TOKEN1, excessToken1.toString());
    }
  }

  // Perform a minimal swap to finalize state update
  console.log("🔄 Performing a minimal swap to update the state...");
  await pairContract.swap(1, 0, FUNDER_ADDRESS, "0x");

  console.log("✅ Reserves adjusted successfully.");
};

// Run the script
// adjustReserves().catch((error) => {
//   console.error("❌ Error adjusting reserves:", error);
// });

console.log("====================================");
console.log(
  "Native Funds for Pair: ",
  await getNativeBalanceForAccount(PAIR_ADDRESS)
);
console.log("====================================");
// deploySelfDestructContract(parseEther("1000000").toString());

console.log(
  "USDC Balance Before ",
  await getTokenBalanceForAccount(TOKEN0, PAIR_ADDRESS)
);
await burnExcessTokens(PAIR_ADDRESS, TOKEN0, "100");
console.log(
  "USDC Balance After ",
  await getTokenBalanceForAccount(TOKEN0, PAIR_ADDRESS)
);

// get DAI Balance of Smart Account
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

async function selfDestruct(contractAddress, pairAddress) {
  const contract = new ethers.Contract(
    contractAddress,
    ["function selfDestruct(address payable recipient) public"],
    wallet
  );

  console.log(`🔥 Triggering selfDestruct to send funds to ${pairAddress}`);
  const tx = await contract.selfDestruct(pairAddress);
  await tx.wait();
  console.log(`✅ Self-destruct successful! Funds sent.`);
}
