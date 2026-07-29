import "dotenv/config";
import { ethers } from "ethers";

const {
    RPC,
    PRIVATE_KEY,
    NETWORK_INCIDENT_CONTRACT_ADDRESS
} = process.env;

if (!RPC) {
    throw new Error("RPC missing in .env");
}

if (!PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY missing in .env");
}

if (!NETWORK_INCIDENT_CONTRACT_ADDRESS) {
    throw new Error(
        "NETWORK_INCIDENT_CONTRACT_ADDRESS missing in .env"
    );
}

const NETWORK_INCIDENT_ABI = [
    // Write functions
    "function logNetworkFailure(string incidentId, bytes32 reasonHash, uint256 failureObservedAt)",

    "function logNetworkRecovery(string incidentId, uint256 recoveryObservedAt) returns (uint256 downtime)",

    // Read functions
    "function getIncident(string incidentId) view returns (bool exists, bool isOpen, bytes32 reasonHash, uint256 failureObservedAt, uint256 recoveryObservedAt, uint256 downtime)",

    "function getIncidentKey(string incidentId) pure returns (bytes32)",

    "function owner() view returns (address)",

    "function authorizedLoggers(address logger) view returns (bool)",

    // Events
    "event NetworkFailureLogged(bytes32 indexed incidentKey, string incidentId, bytes32 indexed reasonHash, uint256 failureObservedAt, uint256 anchoredAt)",

    "event NetworkRecoveryLogged(bytes32 indexed incidentKey, string incidentId, uint256 recoveryObservedAt, uint256 downtime, uint256 anchoredAt)"
];

export const networkIncidentProvider =
    new ethers.JsonRpcProvider(RPC);

export const networkIncidentWallet =
    new ethers.Wallet(
        PRIVATE_KEY,
        networkIncidentProvider
    );

export const networkIncidentContract =
    new ethers.Contract(
        NETWORK_INCIDENT_CONTRACT_ADDRESS,
        NETWORK_INCIDENT_ABI,
        networkIncidentWallet
    );

export { NETWORK_INCIDENT_ABI };