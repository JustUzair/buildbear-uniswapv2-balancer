# Installation

```bash
git clone https://github.com/JustUzair/buildbear-uniswapv2-balancer.git
npm i
```

# Environment Setup

- Mainnet RPC can be obtained from [chainlist.org](https://chainlist.org)
- BuildBear RPC can be obtained from [BuildBear Dashboard](https://app.buildbear.io)
- Pair Address can be obtained by calling `getPair()` on Uniswap V2 Factory Contract
- Pair Address will also identify the tokens (TOKEN0, TOKEN1) addresses
- Funder Address can be the wallet address that is used to fund pair address
- Sandbox Chain ID is chain ID random, same as forked chain id for the sandbox
- Sandbox ID can be identified as follows:
  - `https://rpc.buildbear.io/{SANDBOX-ID}`
- Private Key is the private key for the funder address

```
MAINNET_RPC=
BUILDBEAR_RPC=
PAIR_ADDRESS=
TOKEN0=
TOKEN1=
FUNDER_ADDRESS=
SANDBOX_CHAIN_ID=
SANDBOX_ID=
PRIVATE_KEY=
```

# Execution

Once dependencies are installed and environment setup, run the script

```bash
npm start
```

Correctly executing the script should produce a similar output

```bash
npm start

> uniswap-balancer@1.0.0 start
> npx tsx src/index.ts

🔄 Fetching reserves from mainnet and sandbox...
✅ Mainnet Reserves
USDC :  10123482.100533
WETH :  4880.497939626477228382
✅ Sandbox Reserves
USDC :  10121804.559038
WETH :  4881.450699071537339235
Token0 : 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
Token1 : 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
RAW :: missingToken0 : 1677541495
RAW :: missingToken1 : 0
RAW :: excessToken0 : 0
RAW :: excessToken1 : 952759445060110853
⚠️ 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 Sandbox reserves are lower than mainnet! Minting additional tokens...
🚰 Funding Sandbox: Minting 1677.541495 of Token0 (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 Balance Before : 10121804.559038
🚰 Requesting BuildBear faucet for 1677541495 wei of 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48...
✅ Faucet Success: Funded 1677.541495 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 to 0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc
0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 Balance After : 10123482.100533
⚠️ 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 Sandbox reserves are higher than mainnet! Burning excess tokens...
🔥 Burning 0.952759445060110853 of Token1 (0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2)
✅ Burned 952759445060110853 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 tokens
🔄 Performing sync() update the state...
✅ Pair state updated successfully with sync()
✅ Reserves adjusted successfully.
🔄 Fetching new reserves from mainnet and sandbox...
✅ Mainnet Reserves
USDC :  10123482.100533
WETH :  4880.497939626477228382
✅ Updated Sandbox Reserves
USDC :  10123482.100533
WETH :  4880.497939626477228382
```
