// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NetworkIncidentLog
 * @notice Stores blockchain proofs of network failures and recoveries.
 *
 * Detailed incident information remains in MongoDB.
 * Blockchain stores:
 * - Incident ID
 * - Reason hash
 * - Failure observed time
 * - Recovery observed time
 * - Downtime
 * - Blockchain anchoring time
 */
contract NetworkIncidentLog {

    address public owner;

    mapping(address => bool) public authorizedLoggers;

    struct IncidentState {
        bool exists;
        bool isOpen;
        bytes32 reasonHash;
        uint256 failureObservedAt;
        uint256 recoveryObservedAt;
        uint256 downtime;
    }

    // incidentKey = keccak256(bytes(incidentId))
    mapping(bytes32 => IncidentState) private incidents;

    event LoggerAuthorizationUpdated(
        address indexed logger,
        bool allowed
    );

    event NetworkFailureLogged(
        bytes32 indexed incidentKey,
        string incidentId,
        bytes32 indexed reasonHash,
        uint256 failureObservedAt,
        uint256 anchoredAt
    );

    event NetworkRecoveryLogged(
        bytes32 indexed incidentKey,
        string incidentId,
        uint256 recoveryObservedAt,
        uint256 downtime,
        uint256 anchoredAt
    );

    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "ONLY_OWNER"
        );
        _;
    }

    modifier onlyAuthorizedLogger() {
        require(
            authorizedLoggers[msg.sender],
            "NOT_AUTHORIZED_LOGGER"
        );
        _;
    }

    constructor() {
        owner = msg.sender;

        // Contract deploy karne wala wallet automatically authorized hoga.
        authorizedLoggers[msg.sender] = true;

        emit LoggerAuthorizationUpdated(
            msg.sender,
            true
        );
    }

    /**
     * @notice Authorize or remove a backend blockchain wallet.
     */
    function setAuthorizedLogger(
        address logger,
        bool allowed
    )
        external
        onlyOwner
    {
        require(
            logger != address(0),
            "INVALID_LOGGER"
        );

        authorizedLoggers[logger] = allowed;

        emit LoggerAuthorizationUpdated(
            logger,
            allowed
        );
    }

    /**
     * @notice Anchors a network failure proof.
     *
     * @param incidentId MongoDB incident ID
     * @param reasonHash Hash of the detailed MongoDB failure reason
     * @param failureObservedAt Actual Unix timestamp when failure was detected
     */
    function logNetworkFailure(
        string calldata incidentId,
        bytes32 reasonHash,
        uint256 failureObservedAt
    )
        external
        onlyAuthorizedLogger
    {
        require(
            bytes(incidentId).length > 0,
            "INVALID_INCIDENT_ID"
        );

        require(
            reasonHash != bytes32(0),
            "INVALID_REASON_HASH"
        );

        require(
            failureObservedAt > 0,
            "INVALID_FAILURE_TIME"
        );

        bytes32 incidentKey =
            keccak256(bytes(incidentId));

        require(
            !incidents[incidentKey].exists,
            "INCIDENT_ALREADY_EXISTS"
        );

        incidents[incidentKey] = IncidentState({
            exists: true,
            isOpen: true,
            reasonHash: reasonHash,
            failureObservedAt: failureObservedAt,
            recoveryObservedAt: 0,
            downtime: 0
        });

        emit NetworkFailureLogged(
            incidentKey,
            incidentId,
            reasonHash,
            failureObservedAt,
            block.timestamp
        );
    }

    /**
     * @notice Anchors network recovery and calculates downtime.
     *
     * @param incidentId Existing MongoDB incident ID
     * @param recoveryObservedAt Actual Unix timestamp when RPC recovered
     */
    function logNetworkRecovery(
        string calldata incidentId,
        uint256 recoveryObservedAt
    )
        external
        onlyAuthorizedLogger
        returns (uint256 downtime)
    {
        require(
            bytes(incidentId).length > 0,
            "INVALID_INCIDENT_ID"
        );

        bytes32 incidentKey =
            keccak256(bytes(incidentId));

        IncidentState storage incident =
            incidents[incidentKey];

        require(
            incident.exists,
            "INCIDENT_NOT_FOUND"
        );

        require(
            incident.isOpen,
            "INCIDENT_ALREADY_CLOSED"
        );

        require(
            recoveryObservedAt >= incident.failureObservedAt,
            "INVALID_RECOVERY_TIME"
        );

        downtime =
            recoveryObservedAt -
            incident.failureObservedAt;

        incident.isOpen = false;
        incident.recoveryObservedAt = recoveryObservedAt;
        incident.downtime = downtime;

        emit NetworkRecoveryLogged(
            incidentKey,
            incidentId,
            recoveryObservedAt,
            downtime,
            block.timestamp
        );
    }

    /**
     * @notice Returns complete incident blockchain state.
     */
    function getIncident(
        string calldata incidentId
    )
        external
        view
        returns (
            bool exists,
            bool isOpen,
            bytes32 reasonHash,
            uint256 failureObservedAt,
            uint256 recoveryObservedAt,
            uint256 downtime
        )
    {
        bytes32 incidentKey =
            keccak256(bytes(incidentId));

        IncidentState memory incident =
            incidents[incidentKey];

        return (
            incident.exists,
            incident.isOpen,
            incident.reasonHash,
            incident.failureObservedAt,
            incident.recoveryObservedAt,
            incident.downtime
        );
    }

    /**
     * @notice Generates the blockchain key for an incident ID.
     */
    function getIncidentKey(
        string calldata incidentId
    )
        external
        pure
        returns (bytes32)
    {
        return keccak256(bytes(incidentId));
    }
}