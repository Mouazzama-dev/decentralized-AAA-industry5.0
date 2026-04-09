import { agent } from '../agent.js' 

async function issuePermit(operatorAlias, deviceAlias, role, actions) {
    try {
        const operator = await agent.didManagerGetByAlias({ alias: operatorAlias })
        const device = await agent.didManagerGetByAlias({ alias: deviceAlias })
        const admin = await agent.didManagerGetByAlias({ alias: 'factory-admin' })

        console.log(`🔐 Issuing permit for ${operatorAlias} on ${deviceAlias}...`)

        const vc = await agent.createVerifiableCredential({
            credential: {
                "@context": ["https://www.w3.org/ns/credentials/v2"],
                type: ["VerifiableCredential", "MachineAccessPermit"],
                issuer: { id: admin.did },
                credentialSubject: {
                    id: operator.did,
                    authorizedDeviceId: device.did,
                    role: role,
                    // --- HAR MACHINE KE ALAG ACTIONS ---
                    allowedActions: actions, 
                    validUntil: "2026-12-31"
                },
            },
            proofFormat: 'jwt',
        })

        await agent.dataStoreSaveVerifiableCredential({ verifiableCredential: vc })
        console.log(`✅ Success: ${operatorAlias} can now do: [${actions.join(', ')}]\n`)
    } catch (error) {
        console.error(`❌ Error:`, error.message)
    }
}

async function main() {
    // 1. Marco - Welding Robot (Only Up/Down/On/Off)
    await issuePermit(
        'operator-marco', 
        'welding-robot-09', 
        'SeniorWelder', 
        ["MOVE_UP", "MOVE_DOWN", "SWITCH_ON", "SWITCH_OFF"]
    )

    // 2. Elena - CNC Lathe (Can also ROTATE and CUT)
    await issuePermit(
        'operator-elena', 
        'cnc-lathe-01', 
        'CNC-Specialist', 
        ["SWITCH_ON", "SWITCH_OFF", "ROTATE", "CUT"] 
    )
}

main().catch(console.log)