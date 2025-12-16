/* eslint-disable no-console */
import 'dotenv/config';
import prisma from '../src/client';

async function testDatabase() {
  console.log('🔍 Testing Prisma Postgres connection...\n');

  try {
    // Test basic connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Connected to database!');

    // Count existing records
    const userCount = await prisma.user.count();
    const companyCount = await prisma.company.count();
    const productCount = await prisma.product.count();

    console.log('\n📊 Database Statistics:');
    console.log(`   - Users: ${userCount}`);
    console.log(`   - Companies: ${companyCount}`);
    console.log(`   - Products: ${productCount}`);

    console.log('\n🎉 Database connection test passed!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
