import { PrismaClient } from '@prisma/client';
import { Plan, UserRole } from '../src/common/enums';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clean database
  await prisma.payment.deleteMany();
  await prisma.invoiceHistory.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.client.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemSettings.deleteMany();

  console.log('✅ Database cleaned');

  // Create admin user
  const hashedAdminPassword = await bcrypt.hash('admin@gmail.com', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@gmail.com',
      password: hashedAdminPassword,
      firstName: 'Admin',
      lastName: 'User',
      companyName: 'Invoicy Admin',
      role: UserRole.ADMIN,
      emailVerified: true,
      subscriptionPlan: Plan.ENTERPRISE,
      subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      invoiceLimit: -1, // unlimited
    },
  });
  console.log('✅ Admin user created');
  
  console.log('🎉 Seed completed successfully!');
  console.log('\n📝 Test Credentials:');
  console.log('Admin: admin@gmail.com / admin@gmail.com');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  /*
   The following is the old sample data seeding code (users, clients,
   invoices, payments, history, activity logs). It has been intentionally
   removed from execution to keep only the admin user in the database.
   If you need it later, restore from version control.
  */
