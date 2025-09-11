import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seed start (idempotent)')

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@invoicy.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin@gmail.com'

  // Upsert admin user without destructive deletes
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })

  let passwordHash = existing?.password
  if (!existing || (adminPassword && !(await bcrypt.compare(adminPassword, existing.password)))) {
    passwordHash = await bcrypt.hash(adminPassword, 10)
  }

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: passwordHash!,
      firstName: 'Admin',
      lastName: 'User',
      companyName: 'Invoicy Admin',
      role: 'SUPER_ADMIN',
      emailVerified: true,
      subscriptionPlan: 'ENTERPRISE',
      invoiceLimit: -1,
    },
    create: {
      email: adminEmail,
      password: passwordHash!,
      firstName: 'Admin',
      lastName: 'User',
      companyName: 'Invoicy Admin',
      role: 'SUPER_ADMIN',
      emailVerified: true,
      subscriptionPlan: 'ENTERPRISE',
      invoiceLimit: -1,
    },
  })

  // Create some default public config if not exists
  await prisma.systemSettings.upsert({
    where: { key: 'app-config' },
    update: {},
    create: {
      key: 'app-config',
      description: 'Default public configuration',
      isPublic: true,
      value: {
        name: process.env.APP_NAME || 'Invoicy',
        currency: 'USD',
      },
    },
  })

  console.log('✅ Seed completed')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
