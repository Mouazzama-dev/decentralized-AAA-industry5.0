import { ethers } from "ethers";

import {
    RPC,
    PRIVATE_KEY,
    CONTRACT_ADDRESS
} from "../config/env.js";


const provider =
    new ethers.JsonRpcProvider(RPC);


const wallet =
    new ethers.Wallet(
        PRIVATE_KEY,
        provider
    );


const ABI = [
        {
            "type": "function",
            "name": "getRoot",
            "inputs": [
                {
                    "name": "index",
                    "type": "uint256",
                    "internalType": "uint256"
                }
            ],
            "outputs": [
                {
                    "name": "currentRoot",
                    "type": "bytes32",
                    "internalType": "bytes32"
                },
                {
                    "name": "previousRoot",
                    "type": "bytes32",
                    "internalType": "bytes32"
                },
                {
                    "name": "timestamp",
                    "type": "uint256",
                    "internalType": "uint256"
                },
                {
                    "name": "blockNumber",
                    "type": "uint256",
                    "internalType": "uint256"
                }
            ],
            "stateMutability": "view"
        },
        {
            "type": "function",
            "name": "getRootCount",
            "inputs": [],
            "outputs": [
                {
                    "name": "",
                    "type": "uint256",
                    "internalType": "uint256"
                }
            ],
            "stateMutability": "view"
        },
        {
            "type": "function",
            "name": "logRoot",
            "inputs": [
                {
                    "name": "_currentRoot",
                    "type": "bytes32",
                    "internalType": "bytes32"
                },
                {
                    "name": "_previousRoot",
                    "type": "bytes32",
                    "internalType": "bytes32"
                }
            ],
            "outputs": [],
            "stateMutability": "nonpayable"
        },
        {
            "type": "function",
            "name": "rootHistory",
            "inputs": [
                {
                    "name": "",
                    "type": "uint256",
                    "internalType": "uint256"
                }
            ],
            "outputs": [
                {
                    "name": "currentRoot",
                    "type": "bytes32",
                    "internalType": "bytes32"
                },
                {
                    "name": "previousRoot",
                    "type": "bytes32",
                    "internalType": "bytes32"
                },
                {
                    "name": "timestamp",
                    "type": "uint256",
                    "internalType": "uint256"
                },
                {
                    "name": "blockNumber",
                    "type": "uint256",
                    "internalType": "uint256"
                }
            ],
            "stateMutability": "view"
        },
        {
            "type": "function",
            "name": "storedRoots",
            "inputs": [
                {
                    "name": "",
                    "type": "bytes32",
                    "internalType": "bytes32"
                }
            ],
            "outputs": [
                {
                    "name": "",
                    "type": "bool",
                    "internalType": "bool"
                }
            ],
            "stateMutability": "view"
        },
        {
            "type": "event",
            "name": "RootLogged",
            "inputs": [
                {
                    "name": "currentRoot",
                    "type": "bytes32",
                    "indexed": true,
                    "internalType": "bytes32"
                },
                {
                    "name": "previousRoot",
                    "type": "bytes32",
                    "indexed": true,
                    "internalType": "bytes32"
                },
                {
                    "name": "timestamp",
                    "type": "uint256",
                    "indexed": false,
                    "internalType": "uint256"
                },
                {
                    "name": "blockNumber",
                    "type": "uint256",
                    "indexed": false,
                    "internalType": "uint256"
                }
            ],
            "anonymous": false
        }
    ];


const contract =
    new ethers.Contract(
        CONTRACT_ADDRESS,
        ABI,
        wallet
    );


export {
    contract,
    wallet,
    provider
};