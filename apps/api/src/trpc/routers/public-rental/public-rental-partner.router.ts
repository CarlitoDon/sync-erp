/**
 * Public Rental Partner Router
 *
 * Handles partner (customer) management for external integrations.
 * Extracted from public-rental.router.ts for maintainability.
 */

import { apiKeyProcedure, router } from '../../trpc';
import { z } from 'zod';
import { prisma, PartnerType } from '@sync-erp/database';

export const publicRentalPartnerRouter = router({
  /**
   * Find or create partner by phone
   * Used when creating orders from santi-living
   */
  findOrCreatePartner: apiKeyProcedure
    .input(
      z.object({
        companyId: z.string().min(1),
        name: z.string().min(2),
        phone: z.string().min(10),
        email: z.string().email().optional(),
        // Address fields (all separate)
        address: z.string().optional(),
        street: z.string().optional(),
        kelurahan: z.string().optional(),
        kecamatan: z.string().optional(),
        kota: z.string().optional(),
        provinsi: z.string().optional(),
        zip: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Normalize phone number
      let normalizedPhone = input.phone.replace(/\D/g, '');
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '62' + normalizedPhone.slice(1);
      }

      // Try to find existing partner by phone
      let partner = await prisma.partner.findFirst({
        where: {
          companyId: input.companyId,
          phone: normalizedPhone,
        },
      });

      if (!partner) {
        // Create new partner with all address fields
        partner = await prisma.partner.create({
          data: {
            companyId: input.companyId,
            name: input.name,
            phone: normalizedPhone,
            email: input.email,
            address: input.address,
            street: input.street,
            kelurahan: input.kelurahan,
            kecamatan: input.kecamatan,
            kota: input.kota,
            provinsi: input.provinsi,
            zip: input.zip,
            latitude: input.latitude,
            longitude: input.longitude,
            type: PartnerType.CUSTOMER,
          },
        });
      } else {
        // Update existing partner with new address data if provided
        partner = await prisma.partner.update({
          where: { id: partner.id },
          data: {
            name: input.name,
            address: input.address,
            street: input.street,
            kelurahan: input.kelurahan,
            kecamatan: input.kecamatan,
            kota: input.kota,
            provinsi: input.provinsi,
            zip: input.zip,
            latitude: input.latitude,
            longitude: input.longitude,
          },
        });
      }

      return partner;
    }),
});
