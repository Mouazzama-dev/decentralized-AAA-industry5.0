// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FactoryRegistry} from "../src/FactoryRegistry.sol";

contract DeployFactoryRegistry is Script {

    function run() external returns (FactoryRegistry) {

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        FactoryRegistry registry = new FactoryRegistry();

        console.log("FactoryRegistry deployed at:", address(registry));

        vm.stopBroadcast();

        return registry;
    }
}
