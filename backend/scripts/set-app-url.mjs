#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizeUrl(u) {
  if (!u || typeof u !== 'string') return '';
  let v = u.trim();
  if (!v) return '';
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) {
    v = `https://${v}`;
  }
  return v;
}

async function main() {
  const arg = process.argv[2] || process.env.APP_URL;
  const appUrl = normalizeUrl(arg);
  if (!appUrl) {
    console.error('Usage: node scripts/set-app-url.mjs "https://your-frontend-domain.com"');
    process.exit(1);
  }

  console.log(`Setting APP_URL to: ${appUrl}`);

  await prisma.systemSettings.upsert({
    where: { key: 'APP_URL' },
    create: { key: 'APP_URL', value: appUrl },
    update: { value: appUrl },
  });

  console.log('APP_URL saved in System Settings.');
}

main()
  .catch((e) => {
    console.error('Failed to set APP_URL:', e?.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
