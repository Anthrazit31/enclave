const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../server/config/auth');
const logger = require('../server/utils/logger');

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting database seeding...');

  try {
    // Clear existing data (for development)
    if (process.env.NODE_ENV === 'development') {
      logger.info('Clearing existing data...');
      await prisma.securityLog.deleteMany();
      await prisma.terminalSession.deleteMany();
      await prisma.userSession.deleteMany();
      await prisma.fileSystem.deleteMany();
      await prisma.user.deleteMany();
    }

    // Create admin user
    logger.info('Creating admin user...');
    const adminPassword = await hashPassword('admin123');
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@phoenix-industries.com',
        passwordHash: adminPassword,
        accessLevel: 'ADMIN',
        isActive: true
      }
    });
    logger.info(`Admin user created: ${admin.username}`);

    // Create military user
    logger.info('Creating military user...');
    const militaryPassword = await hashPassword('military123');
    const military = await prisma.user.create({
      data: {
        username: 'military',
        email: 'military@phoenix-industries.com',
        passwordHash: militaryPassword,
        accessLevel: 'MILITARY',
        isActive: true
      }
    });
    logger.info(`Military user created: ${military.username}`);

    // Create researcher user
    logger.info('Creating researcher user...');
    const researcherPassword = await hashPassword('researcher123');
    const researcher = await prisma.user.create({
      data: {
        username: 'researcher',
        email: 'researcher@phoenix-industries.com',
        passwordHash: researcherPassword,
        accessLevel: 'RESEARCHER',
        isActive: true
      }
    });
    logger.info(`Researcher user created: ${researcher.username}`);

    // Create military-researcher user
    logger.info('Creating military-researcher user...');
    const militaryResearcherPassword = await hashPassword('hybrid123');
    const militaryResearcher = await prisma.user.create({
      data: {
        username: 'hybrid',
        email: 'hybrid@phoenix-industries.com',
        passwordHash: militaryResearcherPassword,
        accessLevel: 'MILITARYRESEARCHER',
        isActive: true
      }
    });
    logger.info(`Military-researcher user created: ${militaryResearcher.username}`);

    // Create file system structure
    logger.info('Creating file system structure...');

    // Root directory
    const root = await prisma.fileSystem.create({
      data: {
        name: 'root',
        path: '/',
        type: 'DIRECTORY',
        accessLevel: 'PUBLIC',
        parentId: null
      }
    });

    // System directories
    const system = await prisma.fileSystem.create({
      data: {
        name: 'system',
        path: '/system',
        type: 'DIRECTORY',
        accessLevel: 'ADMIN',
        parentId: root.id
      }
    });

    const military = await prisma.fileSystem.create({
      data: {
        name: 'military',
        path: '/military',
        type: 'DIRECTORY',
        accessLevel: 'MILITARY',
        parentId: root.id
      }
    });

    const research = await prisma.fileSystem.create({
      data: {
        name: 'research',
        path: '/research',
        type: 'DIRECTORY',
        accessLevel: 'RESEARCHER',
        parentId: root.id
      }
    });

    const community = await prisma.fileSystem.create({
      data: {
        name: 'community',
        path: '/community',
        type: 'DIRECTORY',
        accessLevel: 'PUBLIC',
        parentId: root.id
      }
    });

    // Create some files
    await prisma.fileSystem.createMany({
      data: [
        {
          name: 'readme.txt',
          path: '/readme.txt',
          type: 'FILE',
          content: 'Welcome to Phoenix Industries Terminal System\n\nAccess Levels:\n- military: Military personnel access\n- researcher: Research personnel access\n- hybrid: Combined military and research access\n- admin: System administrator\n\nUse the appropriate access code to enter your terminal.',
          accessLevel: 'PUBLIC',
          parentId: root.id
        },
        {
          name: 'system_status.log',
          path: '/system/system_status.log',
          type: 'FILE',
          content: `[${new Date().toISOString()}] System initialized\n[${new Date().toISOString()}] All systems operational\n[${new Date().toISOString()}] Security protocols enabled`,
          accessLevel: 'ADMIN',
          parentId: system.id
        },
        {
          name: 'deployment_orders.txt',
          path: '/military/deployment_orders.txt',
          type: 'FILE',
          content: 'CLASSIFIED: Military Deployment Orders\n\nStatus: All units on standby\nLocation: Phoenix Base\nNext briefing: TBD',
          accessLevel: 'MILITARY',
          parentId: military.id
        },
        {
          name: 'research_notes.md',
          path: '/research/research_notes.md',
          type: 'FILE',
          content: '# Research Notes\n\n## Current Projects\n1. Project Phoenix - Main system development\n2. Security Protocol Analysis\n3. Terminal Interface Optimization\n\n## Recent Findings\n- System performance improved by 47%\n- Security protocols holding strong\n- User feedback positive',
          accessLevel: 'RESEARCHER',
          parentId: research.id
        }
      ]
    });

    // Create community directories
    const communityProfiles = await prisma.fileSystem.create({
      data: {
        name: 'profiles',
        path: '/community/profiles',
        type: 'DIRECTORY',
        accessLevel: 'PUBLIC',
        parentId: community.id
      }
    });

    const communityLeaders = await prisma.fileSystem.create({
      data: {
        name: 'leaders',
        path: '/community/leaders',
        type: 'DIRECTORY',
        accessLevel: 'PUBLIC',
        parentId: community.id
      }
    });

    // Create drone directory
    const drones = await prisma.fileSystem.create({
      data: {
        name: 'drones',
        path: '/drones',
        type: 'DIRECTORY',
        accessLevel: 'MILITARY',
        parentId: root.id
      }
    });

    // Log initial security events
    await prisma.securityLog.createMany({
      data: [
        {
          userId: admin.id,
          eventType: 'LOGIN',
          description: 'System initialization - Admin user created',
          ipAddress: '127.0.0.1',
          userAgent: 'Database Seeder',
          metadata: JSON.stringify({ action: 'system_init' })
        },
        {
          userId: null,
          eventType: 'LOGIN',
          description: 'System initialized - Ready for operations',
          ipAddress: '127.0.0.1',
          userAgent: 'Database Seeder',
          metadata: JSON.stringify({ action: 'system_ready' })
        }
      ]
    });

    logger.info('Database seeding completed successfully!');
    logger.info('Default users created:');
    logger.info('  - Username: admin, Password: admin123, Access: ADMIN');
    logger.info('  - Username: military, Password: military123, Access: MILITARY');
    logger.info('  - Username: researcher, Password: researcher123, Access: RESEARCHER');
    logger.info('  - Username: hybrid, Password: hybrid123, Access: MILITARYRESEARCHER');

  } catch (error) {
    logger.error('Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });