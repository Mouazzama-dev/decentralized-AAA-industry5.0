import { ethers } from "ethers";
import { RPC, PRIVATE_KEY } from "../config/env.js";

const FACTORY_REGISTRY_ADDRESS = process.env.FACTORY_REGISTRY_ADDRESS || "";

const provider = new ethers.JsonRpcProvider(RPC);
const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);

const ABI = [
    {
        "type": "constructor",
        "inputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "registerFactory",
        "inputs": [
            { "name": "factoryId",  "type": "bytes32", "internalType": "bytes32" },
            { "name": "accessLog",  "type": "address", "internalType": "address" }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "getAccessLog",
        "inputs": [
            { "name": "factoryId", "type": "bytes32", "internalType": "bytes32" }
        ],
        "outputs": [
            { "name": "", "type": "address", "internalType": "address" }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getFactoryCount",
        "inputs": [],
        "outputs": [
            { "name": "", "type": "uint256", "internalType": "uint256" }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getFactoryIdAt",
        "inputs": [
            { "name": "index", "type": "uint256", "internalType": "uint256" }
        ],
        "outputs": [
            { "name": "", "type": "bytes32", "internalType": "bytes32" }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "accessLogs",
        "inputs": [
            { "name": "", "type": "bytes32", "internalType": "bytes32" }
        ],
        "outputs": [
            { "name": "", "type": "address", "internalType": "address" }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "owner",
        "inputs": [],
        "outputs": [
            { "name": "", "type": "address", "internalType": "address" }
        ],
        "stateMutability": "view"
    },
    {
        "type": "event",
        "name": "FactoryRegistered",
        "inputs": [
            { "name": "factoryId",    "type": "bytes32", "indexed": true,  "internalType": "bytes32" },
            { "name": "accessLogAddr","type": "address", "indexed": true,  "internalType": "address" },
            { "name": "timestamp",    "type": "uint256", "indexed": false, "internalType": "uint256" }
        ],
        "anonymous": false
    }
];

const getRegistryContract = () => {
    if (!FACTORY_REGISTRY_ADDRESS) {
        throw new Error("FACTORY_REGISTRY_ADDRESS not set in .env");
    }
    return new ethers.Contract(FACTORY_REGISTRY_ADDRESS, ABI, wallet);
};

export { getRegistryContract, wallet, provider };
