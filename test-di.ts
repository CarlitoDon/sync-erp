import './apps/api/src/di-setup.js';
import { container, ServiceKeys } from './apps/api/src/modules/common/di/index.js';
import { RentalService } from './apps/api/src/modules/rental/rental.service.js';

async function main() {
  console.log("=== DI Resolve Test ===");
  const rentalService = container.resolve<RentalService>(ServiceKeys.RENTAL_SERVICE);
  console.log("Rental Service resolved successfully!");
}

main().catch(console.error);
