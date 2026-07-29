// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {NetworkIncidentLog} from "../src/NetworkIncidentLog.sol";

contract DeployNetworkIncidentLog is Script {

    function run()
        external
        returns (NetworkIncidentLog networkIncidentLog)
    {
        uint256 deployerPrivateKey =
            vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        networkIncidentLog =
            new NetworkIncidentLog();

        vm.stopBroadcast();
    }
}