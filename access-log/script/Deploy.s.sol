// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {AccessLog} from "../src/AccessLog.sol";


contract Deploy is Script {

    function run() external returns (AccessLog) {


        uint256 deployerPrivateKey =
            vm.envUint("PRIVATE_KEY");


        vm.startBroadcast(
            deployerPrivateKey
        );


        AccessLog accessLog =
            new AccessLog();


        vm.stopBroadcast();


        return accessLog;
    }
}