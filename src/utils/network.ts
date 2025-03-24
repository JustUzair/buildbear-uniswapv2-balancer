import { createPublicClient, defineChain, http } from "viem";
import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file

const buildbearSandboxUrl = process.env.BUILDBEAR_RPC;
const buildbearSandboxId = process.env.SANDBOX_ID;
if (!buildbearSandboxUrl || !buildbearSandboxId) {
  throw new Error("BUILDBEAR_RPC environment variable is missing");
}

const BBSandboxNetwork = /*#__PURE__*/ defineChain({
  id: 1, // IMPORTANT : replace this with your sandbox's chain id
  name: "BuildBear x Mainnet Sandbox", // name your network
  nativeCurrency: { name: "BBETH", symbol: "BBETH", decimals: 18 }, // native currency of forked network
  rpcUrls: {
    default: {
      http: [buildbearSandboxUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "BuildBear x Mainnet Scan", // block explorer for network
      url: `https://explorer.dev.buildbear.io/${buildbearSandboxId}`,
    },
  },
});

export const publicClient = createPublicClient({
  chain: BBSandboxNetwork,
  transport: http(buildbearSandboxUrl), //@>>> Put in buildbear rpc
});
