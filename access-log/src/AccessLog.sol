// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AccessLog {

    event AccessEvaluated(
        string operatorDid,
        string skill,
        uint256 skillLevel,
        bool granted,
        uint256 timestamp
    );

    function logAccess(
        string memory operatorDid,
        string memory skill,
        uint256 skillLevel,
        bool granted
    ) public {

        emit AccessEvaluated(
            operatorDid,
            skill,
            skillLevel,
            granted,
            block.timestamp
        );
    }
}
