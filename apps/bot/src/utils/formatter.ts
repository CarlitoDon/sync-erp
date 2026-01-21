import type { OrderPayload } from '../types/order';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
};

export const formatOrderMessage = (data: OrderPayload): string => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  let message = `Halo Kak *${data.customerName}*! 👋\n`;
  message += `Terima kasih sudah memesan di *Sewa Kasur Jogja by Santi Mebel*.\n`;
  message += `Order ID: *${data.orderId || '-'}*\n\n`;
  message += `Pesanan Anda telah kami terima dengan rincian berikut:\n\n`;

  // Helper to filter items
  const packages = data.items.filter((i) => i.category === 'package');
  const mattressOnly = data.items.filter(
    (i) => i.category === 'mattress'
  );
  const accessories = data.items.filter(
    (i) => i.category === 'accessory'
  );

  // 1. Paket Kasur
  if (packages.length > 0) {
    message += `*Paket Kasur (Kasur + Bantal + Selimut):*\n`;
    packages.forEach((item) => {
      message += `• ${item.quantity}x ${item.name} @ ${formatCurrency(
        item.pricePerDay
      )}/hari\n`;
    });
    message += `\n`;
  }

  // 2. Kasur Saja
  if (mattressOnly.length > 0) {
    message += `*Kasur Saja:*\n`;
    mattressOnly.forEach((item) => {
      message += `• ${item.quantity}x ${item.name} @ ${formatCurrency(
        item.pricePerDay
      )}/hari\n`;
    });
    message += `\n`;
  }

  // 3. Aksesoris
  if (accessories.length > 0) {
    message += `*Aksesoris Tambahan:*\n`;
    accessories.forEach((item) => {
      message += `• ${item.quantity}x ${item.name} @ ${formatCurrency(
        item.pricePerDay
      )}/hari\n`;
    });
    message += `\n`;
  }

  // Calculate total units (mattresses only)
  const totalQuantity = data.items
    .filter((i) => i.category !== 'accessory')
    .reduce((sum, i) => sum + i.quantity, 0);

  message += `*Detail Sewa:*\n`;
  if (totalQuantity > 0) {
    message += `- Total Kasur: ${totalQuantity} unit\n`;
  }

  if (data.endDate) {
    message += `- Periode: ${formatDate(data.orderDate)} s/d ${formatDate(
      data.endDate
    )}\n`;
  } else {
    message += `- Tanggal Mulai: ${formatDate(data.orderDate)}\n`;
  }

  message += `- Durasi: ${data.duration} hari\n`;
  // Calculate financials
  const discount = data.volumeDiscountAmount || 0;
  // Subtotal (Gross) = Total - Delivery + Discount
  const subtotal = data.totalPrice - data.deliveryFee + discount;

  message += `━━━━━━━━━━━━━\n`;
  message += `*Rincian Biaya:*\n`;
  message += `Subtotal (${data.duration} hari): ${formatCurrency(subtotal)}\n`;

  if (discount > 0) {
    message += `Diskon (${
      data.volumeDiscountLabel || 'Hemat'
    }): -${formatCurrency(discount)}\n`;
  }

  if (data.deliveryFee > 0) {
    message += `Ongkir: ${formatCurrency(data.deliveryFee)}\n`;
  } else {
    message += `Ongkir: Gratis (Free)\n`;
  }

  message += `━━━━━━━━━━━━━\n`;
  message += `*TOTAL BAYAR: ${formatCurrency(data.totalPrice)}*\n`;
  message += `━━━━━━━━━━━━━\n\n`;

  // Add order tracking link FIRST (for WhatsApp link preview)
  if (data.orderUrl) {
    message += `*Link Status Pesanan:*\n`;
    message += `${data.orderUrl}\n`;
    message += `\n_Klik link di atas untuk melihat status pesanan Kakak._\n\n`;
    message += `━━━━━━━━━━━━━━\n`;
  }

  message += `*Detail Pengiriman:*\n`;
  message += `- Nama: ${data.customerName}\n`;
  message += `- Alamat: ${data.deliveryAddress}\n`;

  if (data.addressFields?.lat && data.addressFields?.lng) {
    message += `- Google Maps: https://www.google.com/maps?q=${data.addressFields.lat},${data.addressFields.lng}\n`;
    message += `\n_Mohon cek titik lokasi di atas. Jika kurang tepat, silakan kirim *Share Location* (kanan bawah 📎 > Location) agar pengiriman lebih akurat._\n`;
  }

  if (data.notes && data.notes.trim()) {
    message += `- Catatan: ${data.notes}\n`;
  }

  message += `\nAdmin kami akan segera menghubungi Kakak kembali untuk konfirmasi pengiriman. Terima kasih! 🙏`;

  return message;
};
