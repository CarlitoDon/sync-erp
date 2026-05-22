import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

type LegalPageType = 'privacy' | 'terms';

const lastUpdated = '22 Mei 2026';

const pageCopy: Record<
  LegalPageType,
  {
    title: string;
    eyebrow: string;
    description: string;
    sections: Array<{ title: string; body: string[] }>;
  }
> = {
  privacy: {
    title: 'Privacy Policy',
    eyebrow: 'Data dan privasi',
    description:
      'Ringkasan cara Sync ERP menangani data akun, company, transaksi, integrasi, billing, iklan, dan telemetry produk.',
    sections: [
      {
        title: 'Data yang diproses',
        body: [
          'Sync ERP memproses data akun, company, pengguna, produk, transaksi bisnis, konfigurasi integrasi, audit operasional, billing, dan metadata teknis yang dibutuhkan untuk menjalankan layanan.',
          'Data media hanya tersedia untuk paid tier. Free tier tidak memiliki media access, sehingga UI media disembunyikan dan backend menolak payload media.',
        ],
      },
      {
        title: 'Penggunaan data',
        body: [
          'Data digunakan untuk menyediakan ERP, autentikasi, company context, limit billing, integrasi API, webhook, support, keamanan, observability, dan pengembangan fitur.',
          'Sync ERP tidak menjual data operasional pelanggan. Integrasi pihak ketiga hanya digunakan saat customer mengaktifkan fitur terkait, seperti payment provider, WhatsApp connector, atau AdSense di free tier.',
        ],
      },
      {
        title: 'Iklan di free tier',
        body: [
          'Free tier dapat menampilkan Google AdSense di protected pages. Penayangan iklan bergantung pada konfigurasi environment, approval AdSense, kebijakan Google, dan akses crawler ke halaman yang sesuai.',
          'Paid tier mematikan iklan aplikasi melalui billing feature flag adsEnabled=false.',
        ],
      },
      {
        title: 'Retensi dan penghapusan',
        body: [
          'Data operasional disimpan selama workspace aktif atau selama dibutuhkan untuk audit, billing, keamanan, dan kewajiban legal.',
          'Permintaan export atau penghapusan data dapat dikirim ke support. Penghapusan dapat dibatasi jika data masih dibutuhkan untuk audit transaksi atau kewajiban hukum.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    eyebrow: 'Syarat penggunaan',
    description:
      'Ketentuan penggunaan Sync ERP sebagai produk ERP freemium, API integration platform, dan aplikasi operasional bisnis.',
    sections: [
      {
        title: 'Akses layanan',
        body: [
          'Sync ERP menyediakan ERP freemium. Free tier dibatasi satu company, tanpa media access, dan dapat menampilkan iklan. Paid tier membuka limit dan fitur sesuai plan aktif.',
          'Pengguna bertanggung jawab menjaga keamanan akun, akses tim, API key, dan data yang dimasukkan ke workspace.',
        ],
      },
      {
        title: 'Billing dan upgrade',
        body: [
          'Paid plan berlaku sesuai harga, limit, billing cycle, dan provider checkout yang tersedia di halaman Billing.',
          'Perubahan plan diproses melalui checkout session dan webhook billing. Aktivasi plan dianggap selesai setelah payment provider atau manual checkout mengirim status sukses yang valid.',
        ],
      },
      {
        title: 'Integrasi API',
        body: [
          'API Sync ERP disediakan untuk menghubungkan aplikasi eksternal. Integrator wajib menjaga API key, idempotency, rate limit, dan permission sesuai dokumentasi.',
          'Sync ERP dapat menolak request yang melanggar limit, permission, schema, atau kebijakan keamanan tenant.',
        ],
      },
      {
        title: 'Batasan tanggung jawab',
        body: [
          'Sync ERP membantu pencatatan dan workflow operasional, tetapi keputusan bisnis, akuntansi final, pajak, compliance, dan data entry tetap menjadi tanggung jawab pengguna.',
          'Layanan dapat berubah untuk menjaga keamanan, performa, kepatuhan, dan kelayakan komersial produk.',
        ],
      },
    ],
  },
};

export default function LegalPage({ type }: { type: LegalPageType }) {
  const copy = pageCopy[type];

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${copy.title} | Sync ERP`;

    return () => {
      document.title = previousTitle;
    };
  }, [copy.title]);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f8fafc_0%,#ecfeff_52%,#ffffff_100%)] text-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Kembali ke Sync ERP
        </Link>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800">
            {type === 'privacy' ? (
              <ShieldCheckIcon className="h-4 w-4" />
            ) : (
              <DocumentTextIcon className="h-4 w-4" />
            )}
            {copy.eyebrow}
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            {copy.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            {copy.description}
          </p>
          <p className="mt-4 text-sm font-medium text-slate-500">
            Last updated: {lastUpdated}
          </p>
        </section>

        <div className="mt-6 grid gap-4">
          {copy.sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold text-slate-950">
                {section.title}
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-7 text-amber-900">
          Dokumen ini adalah baseline operasional untuk launch. Sebelum
          public production launch, review dengan penasihat hukum dan
          sesuaikan alamat perusahaan, kontak support, SLA, refund policy,
          dan yurisdiksi yang berlaku.
        </section>
      </div>
    </main>
  );
}
