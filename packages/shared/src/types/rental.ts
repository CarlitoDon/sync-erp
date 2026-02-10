import { Prisma } from '@sync-erp/database';

export type PrismaRentalOrderWithRelations =
  Prisma.RentalOrderGetPayload<{
    include: {
      items: {
        include: {
          rentalItem: {
            include: {
              product: { include: { category: true } };
              units: true;
            };
          };
          rentalBundle: {
            include: {
              components: {
                include: {
                  rentalItem: {
                    include: {
                      product: true;
                    };
                  };
                };
              };
            };
          };
        };
      };
      partner: true;
      deposit: true;
      unitAssignments: {
        include: {
          rentalItemUnit: {
            include: {
              rentalItem: {
                include: {
                  product: { include: { category: true } };
                  units: true;
                };
              };
            };
          };
        };
      };
      return: true;
    };
  }>;

// Portable type for API responses (replaces native Enum with string union)
// This resolves TS2742 errors in consumers like apps/web
export type PortableRentalOrder = Omit<
  PrismaRentalOrderWithRelations,
  'status'
> & {
  status: import('../validators/rental').RentalOrderStatus;
};
