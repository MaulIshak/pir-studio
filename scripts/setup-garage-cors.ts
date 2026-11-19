/**
 * Verify or apply Garage S3 bucket CORS configuration for direct browser
 * presigned URL uploads/downloads (whiteboard images).
 *
 * Usage:
 *   npx tsx scripts/setup-garage-cors.ts --check
 *   npx tsx scripts/setup-garage-cors.ts --apply https://pm.yourdomain.com http://localhost:3000
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3'

if (typeof process.loadEnvFile === 'function') {
  for (const f of ['.env.local', '.env']) {
    const p = resolve(process.cwd(), f)
    if (existsSync(p)) {
      try {
        process.loadEnvFile(p)
      } catch {
        // ignore
      }
    }
  }
}

const endpoint = process.env.S3_ENDPOINT?.trim()
const region = process.env.S3_REGION?.trim() || 'garage'
const bucket = process.env.S3_BUCKET?.trim()
const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim()
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim()

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  console.error('Missing S3_* environment variables.')
  process.exit(1)
}

const client = new S3Client({
  endpoint,
  region,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  credentials: { accessKeyId, secretAccessKey },
})

const mode = process.argv[2] || '--check'

async function main() {
  if (mode === '--apply') {
    const origins = process.argv.slice(3)
    if (origins.length === 0) {
      console.error('Provide at least one allowed origin, e.g.:')
      console.error('  npx tsx scripts/setup-garage-cors.ts --apply http://localhost:3000 https://app.example.com')
      process.exit(1)
    }

    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: origins,
              AllowedMethods: ['GET', 'PUT', 'HEAD'],
              AllowedHeaders: ['Content-Type', 'Content-Length', 'Authorization'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    )
    console.log(`Applied CORS rules to bucket "${bucket}" for origins:`, origins)
  }

  try {
    const res = await client.send(new GetBucketCorsCommand({ Bucket: bucket }))
    console.log(`Current CORS rules on "${bucket}" (${endpoint}):`)
    console.log(JSON.stringify(res.CORSRules ?? [], null, 2))
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name
    const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
    if (name === 'NoSuchCORSConfiguration' || name === 'NotFound' || status === 404) {
      console.log(`Bucket "${bucket}" currently has NO CORS rules configured.`)
      console.log('Run with --apply <origin...> to enable direct presigned browser uploads.')
      return
    }
    throw err
  }
}

main().catch((err) => {
  console.error('Garage CORS check/setup failed:', err)
  process.exit(1)
})
