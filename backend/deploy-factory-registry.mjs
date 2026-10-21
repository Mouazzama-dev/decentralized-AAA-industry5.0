/**
 * Deploy FactoryRegistry.sol to Sepolia using ethers.js.
 * Run: node deploy-factory-registry.mjs
 */
import "dotenv/config";
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const artifact = JSON.parse(
    readFileSync(
        join(__dirname, "../access-log/out/FactoryRegistry.sol/FactoryRegistry.json"),
        "utf8"
    )
);

const provider = new ethers.JsonRpcProvider(process.env.RPC);
const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

console.log("Deploying FactoryRegistry.sol...");
console.log("Deployer:", wallet.address);

const nonce = await provider.getTransactionCount(wallet.address, "pending");
const feeData = await provider.getFeeData();
console.log("Nonce:", nonce);
console.log("maxFeePerGas:", ethers.formatUnits(feeData.maxFeePerGas || feeData.gasPrice, "gwei"), "gwei");

const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, wallet);
const contract = await factory.deploy({ nonce });

console.log("Tx hash:", contract.deploymentTransaction().hash);
console.log("Waiting for confirmation...");

await contract.waitForDeployment();
const addr = await contract.getAddress();

console.log("\n✅ FactoryRegistry deployed at:", addr);
console.log("\nAdd to backend/.env:");
console.log(`FACTORY_REGISTRY_ADDRESS=${addr}`);
