import { assertNotNull } from "@subsquid/util-internal";
import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
} from "@subsquid/evm-processor";
import { events, functions } from "./abi/RailgunSmartWallet";

interface ChainProcessInfo {
  archiveGateway: string;
  rpcEndpoint: string;
}

// https://docs.subsquid.io/subsquid-network/reference/evm-networks/#from-open-private-network
function GetProcessorLookupArchive(chainId: string): ChainProcessInfo {
  switch (chainId) {
    case "1":
      return {
        archiveGateway:
          "https://v2.archive.subsquid.io/network/ethereum-mainnet",
        rpcEndpoint: assertNotNull(process.env.RPC_ETH_HTTP),
      };
    case "137":
      return {
        archiveGateway:
          "https://v2.archive.subsquid.io/network/polygon-mainnet",
        rpcEndpoint: assertNotNull(process.env.RPC_POLYGON_HTTP),
      };
    case "42161":
      return {
        archiveGateway: "https://v2.archive.subsquid.io/network/arbitrum-one",
        rpcEndpoint: assertNotNull(process.env.RPC_ARBITRUM_ONE_HTTP),
      };
    case "56":
      return {
        archiveGateway:
          "https://v2.archive.subsquid.io/network/binance-mainnet",
        rpcEndpoint: assertNotNull(process.env.RPC_BSC_HTTP),
      };
    case "11155111":
      return {
        archiveGateway:
          "https://v2.archive.subsquid.io/network/ethereum-sepolia",
        rpcEndpoint: assertNotNull(process.env.RPC_ETH_SEPOLIA_HTTP),
      };
    default:
      throw new Error(
        `Processor lookup archive not defined for chainId: ${chainId}`
      );
  }
}

const archive = GetProcessorLookupArchive(assertNotNull(process.env.CHAIN_ID));
// replace with environment variable for rpc endpoint if we want to disable rpc
const toggleRPC = assertNotNull(process.env.RAILGUN_RPC_TOGGLE);
if (toggleRPC == "false") {
  console.log("SQUID RPC Proxy is disabled");
  archive.rpcEndpoint = assertNotNull(process.env.RPC_ENDPOINT);
}

console.log({
  "Selected chain -> ": archive,
  contract: process.env.RAILGUN_PROXY_CONTRACT_ADDRESS,
});

export const processor = new EvmBatchProcessor()
  .setGateway(archive.archiveGateway)
  .setRpcEndpoint({
    url: assertNotNull(archive.rpcEndpoint),
    rateLimit: 10,
    retryAttempts: 10,
  })
  .setFinalityConfirmation(75)
  .setFields({
    transaction: {
      from: true,
      value: true,
      hash: true,
    },
  })
  .setBlockRange({
    from: parseInt(process.env.RAILGUN_PROXY_DEPLOYMENT_BLOCK || "0"),
  })
  .addLog({
    address: [assertNotNull(process.env.RAILGUN_PROXY_CONTRACT_ADDRESS)],
    topic0: [
      events.Nullifiers.topic,
      events.Nullified.topic,
      events.CommitmentBatch.topic,
      events.GeneratedCommitmentBatch.topic,
      events.Transact.topic,
      events.Unshield.topic,
      events[
        "Shield(uint256,uint256,(bytes32,(uint8,address,uint256),uint120)[],(bytes32[3],bytes32)[],uint256[])"
      ].topic,
      events[
        "Shield(uint256,uint256,(bytes32,(uint8,address,uint256),uint120)[],(bytes32[3],bytes32)[])"
      ].topic,
    ],
    transaction: true,
  });
  // NOTE: addTrace is disabled to allow free-tier RPC endpoints (no debug_traceBlockByHash).
  // Trace data is only used to populate the Transaction entity from transact() calls.
  // All QuickSync data (commitments, nullifiers, shields, unshields) comes from events.

export type Fields = EvmBatchProcessorFields<typeof processor>;
export type Block = BlockHeader<Fields>;
export type Log = _Log<Fields>;
export type Transaction = _Transaction<Fields>;
export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>;
