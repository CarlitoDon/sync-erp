/**
 * Canonical registry of internal staff, store admins, leadership, and operational
 * numbers for Santi Living and Santi Mebel.
 *
 * Used in MCP tools to:
 * 1. Prevent adding internal staff numbers to whatsapp:allowed_phones
 * 2. Prevent sending automated customer sales messages to internal staff
 */

export const INTERNAL_STAFF_PHONES: ReadonlySet<string> = new Set([
  // Santi Living Leadership & Office
  '6285158858310', // Don (Mas Don / Owner)
  '6289519119092', // Santi Living Sewa Kasur

  // Santi Living Operations & Field Team
  '628987257284',  // Hesy
  '628562747614',  // Andre
  '6283176406083', // Zay

  // Santi Mebel Sales Admins
  '6281249182155', // Admin 1 Sales Santi Mebel
  '6285229092368', // Admin 2 Sales Santi Mebel
  '6281326175144', // Admin 3 Sales Santi Mebel (Godean)
  '6281393267325', // Sales Olshop Santi Mebel
  '6283854465788', // Admin Adel 2

  // Santi Mebel Store / Branch Admins
  '6282221363560', // Admin Santi Mebel Berjo / Toko Berjo
  '6285293361879', // Admin Santi Mebel Gamping / Toko Gamping

  // Santi Mebel Backoffice, Finance, Marketing
  '6281225496416', // Santi Mebel HP Keuangan
  '6281215249054', // Rani Santi Mebel
  '6285842353219', // Mbak Niken Santi Mebel
  '6285290835032', // Ayuni AP Santi Mebel
  '6288229558646', // Jingga AR Santi Mebel
  '6281236272300', // Fahri Marketing 1
  '6281215248998', // Fahri Marketing 2
  '6282135832642', // Fahri Wonosari
  '62816776887',   // Ken Santi Mebel

  // Family & Leadership
  '6282138001051', // Mas Ghana (Santi Mebel Leadership)
  '6289652477983', // Ghana Privat
  '6282133903886', // Ibuk (Santi Mebel Owner / Family)

  // Cargo & Logistics
  '6285148366631', // Eka Admin Tagihan / Sentral Cargo Juwangen
]);

/** Known WhatsApp LIDs for internal staff / stores */
export const INTERNAL_STAFF_LIDS: ReadonlySet<string> = new Set([
  '75432611295262',  // Admin 1 Sales Santi Mebel LID
  '39445415862482',  // Admin Santi Mebel Berjo LID
  '80505320009913',  // Admin Santi Mebel Gamping LID
  '219614797648061', // Yulia Santi Mebel Salis LID
  '31288937459868',  // Salis Santi Mebel LID
  '245302929924242', // Bintang Display Santi Mebel LID
  '279666845822989', // Admin Syifa LID
  '101928230998239', // Toko / Admin Internal LID
]);

/**
 * Checks whether a phone number, raw string, JID, or LID belongs to internal staff.
 */
export function isInternalStaff(identifier: string | null | undefined): boolean {
  if (!identifier) return false;

  const raw = identifier.trim();
  if (!raw) return false;

  const userPart = raw.split('@')[0].split(':')[0];
  const digits = userPart.replace(/\D/g, '');

  if (
    INTERNAL_STAFF_LIDS.has(digits) ||
    INTERNAL_STAFF_LIDS.has(userPart) ||
    INTERNAL_STAFF_LIDS.has(raw)
  ) {
    return true;
  }

  if (!digits) return false;

  const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;

  return (
    INTERNAL_STAFF_PHONES.has(normalized) ||
    INTERNAL_STAFF_PHONES.has(digits) ||
    INTERNAL_STAFF_PHONES.has(userPart)
  );
}
