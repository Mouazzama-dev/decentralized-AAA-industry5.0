import { agent } from '../agent.js'

async function main() {

  const credentials = await agent.dataStoreORMGetVerifiableCredentials()

  console.log(`Found ${credentials.length} credentials\n`)

  if (credentials.length === 0) {
    console.log('No credentials found')
    return
  }

  const credential = credentials[0].verifiableCredential

  console.log('Credential being verified:\n')
  console.log(JSON.stringify(credential, null, 2))


  const result = await agent.verifyCredential({
    credential: {
  "credentialSubject": {
    "role": "Operator",
    "skillName": "CertifiedWelder",
    "skillLevel": 5,
    "id": "did:ethr:sepolia:0x03394afbd6a692f1b0954d2eee3bcf3dc7e31d0a2f3fb90ee5dc791000cfce85fe"
  },
  "issuer": {
    "id": "did:ethr:sepolia:0x03394afbd6a692f1b0954d2eee3bcf3dc7e31d0a2f3fb90ee5dc791000cfce85fe"
  },
  "type": [
    "VerifiableCredential",
    "OperatorSkillCredential"
  ],
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://www.w3.org/ns/credentials/v2"
  ],
  "issuanceDate": "2026-02-16T15:10:46.000Z",
  "proof": {
    "type": "JwtProof2020",
    "jwt": "eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vd3d3LnczLm9yZy9ucy9jcmVkZW50aWFscy92MiJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiT3BlcmF0b3JTa2lsbENyZWRlbnRpYWwiXSwiY3JlZGVudGlhbFN1YmplY3QiOnsicm9sZSI6Ik9wZXJhdG9yIiwic2tpbGxOYW1lIjoiQ2VydGlmaWVkV2VsZGVyIiwic2tpbGxMZXZlbCI6NX19LCJzdWIiOiJkaWQ6ZXRocjpzZXBvbGlhOjB4MDMzOTRhZmJkNmE2OTJmMWIwOTU0ZDJlZWUzYmNmM2RjN2UzMWQwYTJmM2ZiOTBlZTVkYzc5MTAwMGNmY2U4NWZlIiwibmJmIjoxNzcxMjU0NjQ2LCJpc3MiOiJkaWQ6ZXRocjpzZXBvbGlhOjB4MDMzOTRhZmJkNmE2OTJmMWIwOTU0ZDJlZWUzYmNmM2RjN2UzMWQwYTJmM2ZiOTBlZTVkYzc5MTAwMGNmY2U4NWZlIn0.gs_3XACDrtZ0tIKmoCbDRV7JweKplJsA2OdGEblgcMsMna5pf963W98GBt2lEk8gUQOr-P0bfWaDTbfYVPfg4A"
  }
},
  })
  console.log(`Credential verified`, result.verified)


  console.log('\n✅ Verification Result:')
  console.log(result)
}

main().catch(console.log)
