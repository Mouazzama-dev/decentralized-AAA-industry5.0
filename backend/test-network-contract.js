import {
    networkIncidentContract,
    networkIncidentWallet
} from "./blockchain/networkIncident.contract.js";

async function testContractConnection() {
    try {
        const owner =
            await networkIncidentContract.owner();

        const walletAddress =
            await networkIncidentWallet.getAddress();

        const isAuthorized =
            await networkIncidentContract
                .authorizedLoggers(walletAddress);

        console.log("Contract owner:", owner);
        console.log("Backend wallet:", walletAddress);
        console.log("Wallet authorized:", isAuthorized);
    } catch (error) {
        console.error(
            "Contract connection failed:",
            error.message
        );
    }
}

testContractConnection();