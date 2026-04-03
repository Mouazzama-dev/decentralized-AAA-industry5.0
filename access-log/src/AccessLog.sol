// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AccessLog
 * @dev This contract implements an efficient auditing system for Industrial IoT operations.
 * It uses a batching strategy to log multiple operator actions in a single transaction
 * to minimize Gas costs on the Ethereum network.
 */
contract AccessLog {

    /**
     * @dev Event to store the audit trail in the blockchain logs.
     * Storing data in Events is significantly cheaper than using State Variables (Storage).
     * @param operatorDid The Decentralized Identifier of the operator.
     * @param deviceDid The Decentralized Identifier of the industrial machine.
     * @param actionCodes An array of integers representing specific operations (e.g., 0: MoveUp, 1: MoveDown).
     * @param timestamp The block time when the batch was recorded.
     */
    event BatchLogged(
        string operatorDid,
        string deviceDid,
        uint8[] actionCodes, 
        uint256 timestamp
    );

    /**
     * @notice Logs a batch of 10 or more operations in a single transaction.
     * @dev This function does not save data to the contract's state to remain gas-efficient.
     * Instead, it emits an event which remains permanently searchable in the blockchain history.
     * @param _operatorDid The DID of the authorized person performing the actions.
     * @param _deviceDid The DID of the specific machine being operated.
     * @param _actionCodes An array of encoded integers representing the sequence of moves/commands.
     */
    function logBatch(
        string memory _operatorDid, 
        string memory _deviceDid, 
        uint8[] memory _actionCodes
    ) public {
        // We trigger an event instead of using 'SSTORE' operations to save ~90% in Gas fees.
        // This provides full 'Accounting' transparency for auditors without high operational costs.
        emit BatchLogged(_operatorDid, _deviceDid, _actionCodes, block.timestamp);
    }
}