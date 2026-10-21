import { ethers } from "ethers";
import { getRegistryContract } from "../blockchain/factoryRegistry.contract.js";

// Convert a human-readable factory name to bytes32 (keccak256 hash)
const toFactoryId = (name) => ethers.id(name);   // ethers.id() = keccak256(utf8)

// Register this factory's AccessLog address in the on-chain FactoryRegistry.
// Only the platform admin (contract owner) can call this.
// factoryName: e.g. "factory-A"
// accessLogAddress: e.g. process.env.CONTRACT_ADDRESS
const registerFactory = async (factoryName, accessLogAddress) => {
    const registry = getRegistryContract();
    const factoryId = toFactoryId(factoryName);

    const tx = await registry.registerFactory(factoryId, accessLogAddress);
    const receipt = await tx.wait();

    return {
        factoryName,
        factoryId,
        accessLogAddress,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber
    };
};

// Look up the AccessLog address for a given factory name.
const getAccessLog = async (factoryName) => {
    const registry = getRegistryContract();
    const factoryId = toFactoryId(factoryName);
    const addr = await registry.getAccessLog(factoryId);
    return { factoryName, factoryId, accessLogAddress: addr };
};

// Return a list of all registered factories with their AccessLog addresses.
const getAllFactories = async () => {
    const registry = getRegistryContract();
    const count = Number(await registry.getFactoryCount());
    const results = [];

    for (let i = 0; i < count; i++) {
        const fid = await registry.getFactoryIdAt(i);
        const addr = await registry.accessLogs(fid);
        results.push({ factoryId: fid, accessLogAddress: addr, index: i });
    }

    return results;
};

export { registerFactory, getAccessLog, getAllFactories, toFactoryId };
