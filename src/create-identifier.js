import { agent } from '../agent.js'

async function main() {
  const identifier = await agent.didManagerCreate({ alias: 'default' })

  console.log('\n✅ New Identifier Created:')
  console.log(JSON.stringify(identifier, null, 2))
}

main().catch(console.log)
