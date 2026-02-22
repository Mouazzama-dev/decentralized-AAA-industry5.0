import {agent} from '../agent.js';

async function main() {
    const identifiers = await agent.didManagerFind();
    const holder = identifiers[0];
    console.log('Using identifier', holder);

    const credentials = await agent.dataStoreORMGetVerifiableCredentials()

    if (credentials.length === 0) {
    console.log("❌ No credentials found")
    return
  }

  const credential = credentials[0].verifiableCredential

  const presentation = await agent.createVerifiablePresentation({
    presentation: {
      holder: holder.did,
      verifiableCredential: [credential],
    },
    proofFormat: 'jwt',
  })

  console.log("\n🎉 PRESENTATION CREATED:\n")
  console.log(JSON.stringify(presentation, null, 2))
}

main().catch(console.log)