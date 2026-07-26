// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


/**
 * @title AccessLog
 * @dev Stores chained Merkle roots for industrial audit verification.
 * Raw events remain off-chain. Blockchain stores only integrity proofs.
 */
contract AccessLog {


    struct RootRecord {

        bytes32 currentRoot;

        bytes32 previousRoot;

        uint256 timestamp;

        uint256 blockNumber;

    }


    event RootLogged(

        bytes32 indexed currentRoot,

        bytes32 indexed previousRoot,

        uint256 timestamp,

        uint256 blockNumber

    );


    mapping(bytes32 => bool) public storedRoots;


    RootRecord[] public rootHistory;



    /**
     * @notice Anchors a Merkle root on blockchain.
     * @param _currentRoot Current batch Merkle root
     * @param _previousRoot Previous chained Merkle root
     */
    function logRoot(
        bytes32 _currentRoot,
        bytes32 _previousRoot
    )
    public
    {

        require(
            !storedRoots[_currentRoot],
            "Root already exists"
        );


        storedRoots[_currentRoot] = true;


        RootRecord memory record =
            RootRecord(
                _currentRoot,
                _previousRoot,
                block.timestamp,
                block.number
            );


        rootHistory.push(record);


        emit RootLogged(
            _currentRoot,
            _previousRoot,
            block.timestamp,
            block.number
        );

    }



    /**
     * @notice Returns total anchored roots.
     */
    function getRootCount()
    public
    view
    returns(uint256)
    {
        return rootHistory.length;
    }



    /**
     * @notice Retrieve root information.
     */
    function getRoot(
        uint256 index
    )
    public
    view
    returns(
        bytes32 currentRoot,
        bytes32 previousRoot,
        uint256 timestamp,
        uint256 blockNumber
    )
    {

        RootRecord memory record =
            rootHistory[index];


        return(
            record.currentRoot,
            record.previousRoot,
            record.timestamp,
            record.blockNumber
        );

    }

}