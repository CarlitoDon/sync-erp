import QRCode from "qrcode";

/**
 * Basic QRIS Dynamic Generator (Simplified)
 * Note: For production use, it's recommended to use a proper library or official API
 */
export const generateQrisDynamic = async (
  staticPayload: string,
  amount: number
): Promise<string> => {
  // 1. Remove the last 4 characters (old CRC)
  let basePayload = staticPayload.slice(0, -4);

  // 2. Locate placement for dynamic amount (Tag 54)
  // This is a simplified version. QRIS parsing is complex,
  // but for many merchants, replacing/adding Tag 54 works.
  // Format Tag 54: 54 + length + amount
  const strAmount = amount.toString();
  const tag54 = `54${strAmount.length.toString().padStart(2, "0")}${strAmount}`;

  // Replace or inject amount point (simplified logic)
  if (basePayload.includes("54")) {
    const parts = basePayload.split("5802ID"); // Usually 5802ID comes after amount
    const before54 = parts[0].split("54")[0];
    basePayload = before54 + tag54 + "5802ID" + parts[1];
  } else {
    basePayload = basePayload.replace("5802ID", tag54 + "5802ID");
  }

  // 3. Calculate new CRC16
  const newCrc = calculateCRC16(basePayload);
  return basePayload + newCrc;
};

export const generateQrisImageBase64 = async (
  payload: string
): Promise<string> => {
  const dataUrl = await QRCode.toDataURL(payload, {
    margin: 2,
    scale: 10,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
  // Return base64 without prefix
  return dataUrl.split(",")[1];
};

/**
 * CRC16 Calculation for QRIS (IBM/CCITT-FALSE)
 */
function calculateCRC16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    let x = ((crc >> 8) ^ str.charCodeAt(i)) & 0xff;
    x ^= x >> 4;
    crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
