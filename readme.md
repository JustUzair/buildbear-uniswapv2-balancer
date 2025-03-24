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
