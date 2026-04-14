import { Client } from 'pg'
import { readFileSync } from 'fs'
import { lookup } from 'dns/promises'

// Force IPv4 — the direct Supabase hostname resolves to IPv6 too, and many
// dev networks can't route to IPv6 endpoints.
async function resolveHostIPv4(host: string): Promise<string> {
  const res = await lookup(host, { family: 4 })
  return res.address
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: npx tsx scripts/run-migration.ts <sql-file>')
    process.exit(1)
  }

  const sql = readFileSync(file, 'utf8')
  const url = new URL(env.DATABASE_URL)
  const ipv4 = await resolveHostIPv4(url.hostname)
  const client = new Client({
    host: ipv4,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    // Supabase requires SSL but uses self-signed certs on the direct connection.
    ssl: { rejectUnauthorized: false, servername: url.hostname },
  })
  await client.connect()
  try {
    console.log(`Running ${file}...`)
    await client.query(sql)
    console.log('OK')
  } finally {
    await client.end()
  }
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
