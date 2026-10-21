// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FactoryRegistry
 * @notice On-chain directory mapping factory IDs to their AccessLog contracts.
 *         Deployed once by the platform. Each factory registers its own
 *         AccessLog address. An auditor only needs this contract's address
 *         to discover and query every factory's audit chain.
 *
 * Multi-Factory AAA Design Plan — Challenge 3.
 */
contract FactoryRegistry {

    address public owner;

    struct FactoryEntry {
        bytes32 factoryId;
        address accessLogAddr;
        uint256 registeredAt;
    }

    // factoryId → AccessLog address
    mapping(bytes32 => address) public accessLogs;

    // ordered list of all registered factory IDs (for enumeration)
    bytes32[] public factoryIds;

    event FactoryRegistered(
        bytes32 indexed factoryId,
        address indexed accessLogAddr,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "FactoryRegistry: not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Register or update a factory's AccessLog contract address.
     * @param factoryId  Short identifier, e.g. keccak256("factory-A")
     * @param accessLog  Address of that factory's deployed AccessLog.sol
     */
    function registerFactory(bytes32 factoryId, address accessLog) external onlyOwner {
        require(accessLog != address(0), "FactoryRegistry: zero address");

        if (accessLogs[factoryId] == address(0)) {
            // new entry
            factoryIds.push(factoryId);
        }

        accessLogs[factoryId] = accessLog;

        emit FactoryRegistered(factoryId, accessLog, block.timestamp);
    }

    /**
     * @notice Look up the AccessLog address for a given factory.
     */
    function getAccessLog(bytes32 factoryId) external view returns (address) {
        return accessLogs[factoryId];
    }

    /**
     * @notice Returns the total number of registered factories.
     */
    function getFactoryCount() external view returns (uint256) {
        return factoryIds.length;
    }

    /**
     * @notice Returns the factory ID at position `index`.
     */
    function getFactoryIdAt(uint256 index) external view returns (bytes32) {
        return factoryIds[index];
    }
}
