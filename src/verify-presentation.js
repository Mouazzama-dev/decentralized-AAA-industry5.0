import { agent } from '../agent.js'

async function main() {

  const presentations = await agent.dataStoreORMGetVerifiableCredentials()

  const credentials = await agent.dataStoreORMGetVerifiableCredentials()

  if (credentials.length === 0) {
    console.log("❌ No credentials in DB")
    return
  }

  const vc = credentials[0].verifiableCredential


  const vp = await agent.createVerifiablePresentation({
    presentation: {
      holder: vc.credentialSubject.id,
      verifiableCredential: [vc],
    },
    proofFormat: 'jwt',
  })

  console.log("\n🛡 Gateway Verifying Presentation...\n")

  const result = await agent.verifyPresentation({ presentation: vp })

  console.log("✅ Verification Result:\n")
  console.log(result)
}

main().catch(console.log)
