import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui';
import {
  TruckIcon,
  MapPinIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  BuildingOffice2Icon,
  SparklesIcon,
  ClipboardDocumentListIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
export interface RentalLogisticsOrder {
  deliveryAddress?: string | null;
  notes?: string | null;
  latitude?: number | string | { toString(): string } | null;
  longitude?: number | string | { toString(): string } | null;
  partner?: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
}

interface RentalLogisticsCardProps {
  order: RentalLogisticsOrder;
}

function extractGoogleMapsUrl(
  deliveryAddress?: string | null,
  notes?: string | null,
  latitude?: number | string | { toString(): string } | null,
  longitude?: number | string | { toString(): string } | null,
  fallbackAddress?: string | null
): string | null {
  // 1. Check coordinates if valid
  if (
    latitude !== undefined &&
    latitude !== null &&
    longitude !== undefined &&
    longitude !== null
  ) {
    const lat = Number(latitude.toString());
    const lng = Number(longitude.toString());
    if (!Number.isNaN(lat) && !Number.isNaN(lng) && (lat !== 0 || lng !== 0)) {
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
  }

  const combined = `${deliveryAddress ?? ''}\n${notes ?? ''}`;

  // 2. Direct Google Maps URL pattern
  const mapsRegex =
    /(https?:\/\/(?:www\.)?(?:google\.com\/maps[^\s]+|maps\.google\.com[^\s]+|maps\.app\.goo\.gl[^\s]+|goo\.gl\/maps[^\s]+))/i;
  const match = combined.match(mapsRegex);
  if (match) {
    return match[1];
  }

  // 3. Explicit label match
  const explicitMatch = combined.match(
    /(?:Maps|Titik Google Maps):\s*(https?:\/\/[^\s]+)/i
  );
  if (explicitMatch) {
    return explicitMatch[1];
  }

  // 4. Fallback search URL if deliveryAddress text exists
  const cleanAddr =
    getCleanDeliveryAddress(deliveryAddress) ||
    fallbackAddress?.trim() ||
    '';
  if (cleanAddr) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      cleanAddr
    )}`;
  }

  return null;
}

function getCleanDeliveryAddress(deliveryAddress?: string | null): string {
  if (!deliveryAddress) return '';
  return deliveryAddress
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^(?:maps|titik google maps)\s*:\s*https?:\/\//i.test(trimmed)) {
        return false;
      }
      if (
        /^https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(
          trimmed
        )
      ) {
        return false;
      }
      return true;
    })
    .join('\n')
    .trim();
}

function formatWhatsAppUrl(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  let waNumber = digits;
  if (waNumber.startsWith('0')) {
    waNumber = '62' + waNumber.slice(1);
  } else if (waNumber.startsWith('8')) {
    waNumber = '62' + waNumber;
  }
  return `https://wa.me/${waNumber}`;
}

interface LogisticsBadges {
  upstairsFloor?: string | null;
  fittedSheet?: string | null;
}

function extractLogisticsBadges(
  notes?: string | null,
  address?: string | null
): LogisticsBadges {
  const combined = `${notes ?? ''}\n${address ?? ''}`;
  let upstairsFloor: string | null = null;
  let fittedSheet: string | null = null;

  // Floor matching: "Kasur naik lantai atas: X unit", "Naik ke lantai X", "Lantai X", etc.
  const upstairsMatch = combined.match(
    /(?:kasur\s+)?naik(?:\s+ke)?\s+lantai(?:\s+atas)?(?::|\s+)?\s*([^\n,]+)/i
  );
  if (upstairsMatch) {
    const raw = upstairsMatch[1].trim();
    if (!/^(?:0|0\s*unit|tidak|no|false|-)$/i.test(raw)) {
      upstairsFloor = raw;
    }
  } else {
    const floorMatch = combined.match(/lantai\s+(\d+|[A-Za-z0-9]+)/i);
    if (floorMatch) {
      const raw = floorMatch[1].trim();
      if (!/^(?:0|tidak|no|false|-)$/i.test(raw)) {
        upstairsFloor = `Lantai ${raw}`;
      }
    }
  }

  // Fitted sheet matching: "Pasang sprei: X unit", "Pasang Sprei: Ya", "Pasang sprei: Tidak"
  const sheetMatch = combined.match(/pasang\s+sprei(?::|\s+)?\s*([^\n,]+)/i);
  if (sheetMatch) {
    const val = sheetMatch[1].trim();
    if (/^(?:0|0\s*unit|tidak|no|false|bukan|-)$/i.test(val)) {
      fittedSheet = null;
    } else if (/unit/i.test(val)) {
      fittedSheet = val;
    } else {
      fittedSheet = 'Ya';
    }
  }

  return { upstairsFloor, fittedSheet };
}

function formatFloorBadge(raw: string): string {
  const trimmed = raw.trim();
  if (/^lantai\s+/i.test(trimmed)) {
    return trimmed;
  }
  if (/^\d+$/.test(trimmed)) {
    return `Lantai ${trimmed}`;
  }
  if (/unit/i.test(trimmed)) {
    return `Naik Lantai: ${trimmed}`;
  }
  return `Naik ${trimmed}`;
}

function getOperationalNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const lines = notes.split('\n').filter((line) => {
    const trimmed = line.trim();
    return (
      !trimmed.startsWith('Titik Google Maps:') &&
      !trimmed.startsWith('Maps:') &&
      !trimmed.toLowerCase().startsWith('kasur naik lantai') &&
      !trimmed.toLowerCase().startsWith('pasang sprei:') &&
      !trimmed.toLowerCase().startsWith('deposit / uang jaminan:')
    );
  });
  const filtered = lines.join('\n').trim();
  return filtered || null;
}

export function RentalLogisticsCard({ order }: RentalLogisticsCardProps) {
  const cleanAddress =
    getCleanDeliveryAddress(order.deliveryAddress) ||
    order.partner?.address ||
    '';
  const mapsUrl = extractGoogleMapsUrl(
    order.deliveryAddress,
    order.notes,
    order.latitude,
    order.longitude,
    cleanAddress
  );
  const waUrl = formatWhatsAppUrl(order.partner?.phone);
  const { upstairsFloor, fittedSheet } = extractLogisticsBadges(
    order.notes,
    order.deliveryAddress
  );
  const operationalNotes = getOperationalNotes(order.notes);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TruckIcon className="w-5 h-5 text-primary-600" />
            <CardTitle>Pengiriman & Logistik</CardTitle>
          </div>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 transition-colors border border-emerald-200/80 shadow-xs"
              title="Buka titik lokasi di Google Maps"
            >
              <MapPinIcon className="w-4 h-4 text-emerald-600" />
              <span>Buka di Google Maps</span>
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Badges for special mattress handling */}
        {(upstairsFloor || fittedSheet) && (
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {upstairsFloor && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <BuildingOffice2Icon className="w-4 h-4 text-indigo-500" />
                {formatFloorBadge(upstairsFloor)}
              </span>
            )}
            {fittedSheet && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                <SparklesIcon className="w-4 h-4 text-teal-500" />
                Pasang Sprei: {fittedSheet}
              </span>
            )}
          </div>
        )}

        {/* Address and Contact Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Delivery Address */}
          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <MapPinIcon className="w-4 h-4 text-slate-400" />
              <span>Alamat Pengantaran</span>
            </div>
            {cleanAddress ? (
              <p className="text-sm font-medium text-slate-900 whitespace-pre-line leading-relaxed">
                {cleanAddress}
              </p>
            ) : (
              <p className="text-sm italic text-slate-400">
                Belum ada alamat pengantaran tercatat.
              </p>
            )}
          </div>

          {/* Recipient & WhatsApp */}
          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <PhoneIcon className="w-4 h-4 text-slate-400" />
              <span>Kontak Penerima</span>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                {order.partner?.name || 'Pelanggan'}
              </p>
              <p className="text-sm text-slate-600 font-mono">
                {order.partner?.phone || '-'}
              </p>
            </div>
            {waUrl && (
              <div className="pt-1">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
                  title="Kirim pesan WhatsApp ke penerima"
                >
                  <ChatBubbleLeftRightIcon className="w-4 h-4" />
                  <span>Hubungi via WhatsApp</span>
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Operational / Driver Notes */}
        {operationalNotes && (
          <div className="rounded-lg bg-amber-50/80 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-950">
              <ClipboardDocumentListIcon className="w-4 h-4 text-amber-600" />
              <span>Catatan Operasional & Kurir</span>
            </div>
            <p className="whitespace-pre-line leading-relaxed text-amber-900/90 pl-5.5">
              {operationalNotes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
