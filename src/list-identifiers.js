import { agent } from '../agent.js'

async function main() {
  const identifiers = await agent.didManagerFind()

  console.log(`\n✅ There are ${identifiers.length} identifiers\n`)

  identifiers.map((id) => {
    console.log(id.did)
    console.log('---------------------------')
  })
}

main().catch(console.log)
