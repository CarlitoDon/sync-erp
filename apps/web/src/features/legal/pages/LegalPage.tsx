import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

type LegalPageType = 'privacy' | 'terms';

const lastUpdated = '29 Mei 2026';

/* ------------------------------------------------------------------ */
/* Company identity — update before production launch                  */
/* ------------------------------------------------------------------ */
const COMPANY_LEGAL_NAME = '[NAMA PERUSAHAAN]'; // TODO: PT/CV resmi
const COMPANY_ADDRESS = '[ALAMAT LENGKAP]'; // TODO: alamat terdaftar
const COMPANY_EMAIL = 'support@sync-erp.com';
const COMPANY_PHONE = '[NOMOR TELEPON]'; // TODO: nomor resmi

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
        title: 'Identitas pengendali data',
        body: [
          `Pengendali data: ${COMPANY_LEGAL_NAME}, beralamat di ${COMPANY_ADDRESS}.`,
          `Untuk pertanyaan privasi, hubungi kami di ${COMPANY_EMAIL} atau ${COMPANY_PHONE}.`,
        ],
      },
      {
        title: 'Data yang diproses',
        body: [
          'Sync ERP memproses data akun (nama, email, autentikasi), data company, pengguna, produk, transaksi bisnis (sales order, purchase order, invoice, bill, payment), konfigurasi integrasi, audit operasional, billing, dan metadata teknis yang dibutuhkan untuk menjalankan layanan.',
          'Data media hanya tersedia untuk paid tier. Free tier tidak memiliki media access, sehingga UI media disembunyikan dan backend menolak payload media.',
          'Untuk pengguna free tier, Google AdSense dapat menampilkan iklan di halaman tertentu. Data browsing dapat diproses oleh Google sesuai kebijakan privasi Google.',
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
        title: 'Dasar pemrosesan',
        body: [
          'Pemrosesan data didasarkan pada pelaksanaan kontrak (provision of service), persetujuan (untuk iklan dan komunikasi pemasaran), dan kepentingan sah (keamanan, pencegahan penipuan, peningkatan layanan).',
          'Anda dapat menarik persetujuan kapan saja melalui pengaturan akun atau dengan menghubungi support.',
        ],
      },
      {
        title: 'Pihak ketiga dan transfer data',
        body: [
          'Data dapat diproses oleh penyedia layanan pihak ketiga yang mendukung operasi Sync ERP, termasuk penyedia cloud hosting, payment gateway (Midtrans), layanan autentikasi (Google OAuth), dan WhatsApp connector.',
          'Transfer data ke pihak ketiga dilakukan hanya sejauh diperlukan untuk menyediakan layanan dan dilindungi oleh perjanjian pemrosesan data yang sesuai.',
        ],
      },
      {
        title: 'Iklan di free tier',
        body: [
          'Free tier dapat menampilkan Google AdSense di protected pages. Penayangan iklan bergantung pada konfigurasi environment, approval AdSense, kebijakan Google, dan consent pengguna.',
          'Paid tier mematikan iklan aplikasi melalui billing feature flag adsEnabled=false.',
          'Pengguna dapat mengelola preferensi iklan melalui banner consent yang ditampilkan pada kunjungan pertama.',
        ],
      },
      {
        title: 'Cookie dan teknologi serupa',
        body: [
          'Sync ERP menggunakan cookie teknis (session, autentikasi, preferensi) yang diperlukan untuk operasi layanan.',
          'Cookie iklan dan tracking (Google AdSense/Analytics) hanya diaktifkan setelah persetujuan eksplisit pengguna melalui banner consent.',
          'Pengguna dapat mengubah preferensi cookie kapan saja melalui tautan "Kelola Cookie" di footer situs.',
        ],
      },
      {
        title: 'Retensi dan penghapusan',
        body: [
          'Data operasional disimpan selama workspace aktif atau selama dibutuhkan untuk audit, billing, keamanan, dan kewajiban legal.',
          'Data akun dapat dihapus dengan mengirim permintaan ke support@sync-erp.com dari email terdaftar. Proses verifikasi identitas akan dilakukan sebelum penghapusan.',
          'Penghapusan data akan diproses dalam 30 hari kerja. Beberapa data mungkin disimpan lebih lama jika diperlukan untuk kewajiban hukum, audit transaksi, atau penyelesaian sengketa.',
        ],
      },
      {
        title: 'Ekspor data',
        body: [
          'Pengguna dapat meminta ekspor data operasional (produk, transaksi, partner) melalui fitur export bawaan di setiap modul ERP atau dengan mengajukan permintaan ke support.',
          'Ekspor akan disediakan dalam format CSV atau JSON dalam waktu 7 hari kerja.',
        ],
      },
      {
        title: 'Hak-hak Anda',
        body: [
          'Sesuai peraturan perlindungan data Indonesia, Anda memiliki hak untuk: mengakses data pribadi Anda, memperbaiki data yang tidak akurat, menghapus data, membatasi pemrosesan, dan menerima data dalam format terstruktur.',
          'Untuk menggunakan hak-hak ini, hubungi support@sync-erp.com.',
        ],
      },
      {
        title: 'Kontak dan pengaduan',
        body: [
          `Untuk pertanyaan, permintaan data, atau pengaduan terkait privasi, hubungi: ${COMPANY_EMAIL}.`,
          'Jika tidak puas dengan tanggapan kami, Anda dapat mengajukan pengaduan kepada otoritas perlindungan data yang berlaku di Indonesia.',
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
        title: 'Identitas penyedia layanan',
        body: [
          `Layanan ini disediakan oleh ${COMPANY_LEGAL_NAME}, beralamat di ${COMPANY_ADDRESS}.`,
          `Kontak: ${COMPANY_EMAIL} | ${COMPANY_PHONE}.`,
        ],
      },
      {
        title: 'Akses layanan',
        body: [
          'Sync ERP menyediakan ERP freemium. Free tier dibatasi satu company, tanpa media access, dan dapat menampilkan iklan. Paid tier membuka limit dan fitur sesuai plan aktif (Starter, Growth, Scale, Enterprise).',
          'Pengguna bertanggung jawab menjaga keamanan akun, akses tim, API key, dan data yang dimasukkan ke workspace.',
          'Akses layanan tunduk pada ketersediaan sistem. Sync ERP berusaha menjaga uptime maksimum tetapi tidak menjamin ketersediaan 100%.',
        ],
      },
      {
        title: 'Billing dan upgrade',
        body: [
          'Paid plan berlaku sesuai harga, limit, billing cycle, dan provider checkout yang tersedia di halaman Billing.',
          'Perubahan plan diproses melalui checkout session dan webhook billing. Aktivasi plan dianggap selesai setelah payment provider mengirim status sukses yang valid.',
          'Harga dapat berubah dengan pemberitahuan 30 hari sebelumnya melalui email atau notifikasi in-app.',
        ],
      },
      {
        title: 'Pembatalan dan refund',
        body: [
          'Pengguna dapat membatalkan paid plan kapan saja melalui halaman Billing. Pembatalan berlaku akhir periode billing yang sedang berjalan.',
          'Refund diberikan secara pro-rata jika pembatalan dilakukan dalam 7 hari pertama langganan.',
          'Refund tidak berlaku untuk: (a) penggunaan yang melanggar ketentuan layanan, (b) force majeure, atau (c) fitur yang telah digunakan secara aktif selama lebih dari 7 hari.',
          'Permintaan refund diajukan ke support@sync-erp.com dengan menyertakan alasan dan bukti pembayaran.',
        ],
      },
      {
        title: 'Service Level Agreement (SLA)',
        body: [
          'Target uptime untuk paid tier: 99.5% per bulan, diukur dari endpoint API utama.',
          'Downtime terjadwal (maintenance) akan diberitahukan minimal 24 jam sebelumnya dan tidak dihitung sebagai downtime.',
          'Kompensasi SLA: kredit layanan pro-rata untuk downtime yang melebihi target, diajukan dalam 30 hari setelah insiden.',
          'Free tier tidak memiliki SLA uptime.',
        ],
      },
      {
        title: 'Integrasi API',
        body: [
          'API Sync ERP disediakan untuk menghubungkan aplikasi eksternal. Integrator wajib menjaga API key, idempotency, rate limit, dan permission sesuai dokumentasi.',
          'Sync ERP dapat menolak request yang melanggar limit, permission, schema, atau kebijakan keamanan tenant.',
          'Penggunaan API yang berlebihan atau berbahaya (DDoS, scraping massal, brute force) akan mengakibatkan pemblokiran akses.',
        ],
      },
      {
        title: 'Penggunaan yang dapat diterima',
        body: [
          'Pengguna dilarang: (a) menggunakan layanan untuk aktivitas ilegal, (b) mencoba mengakses data pengguna lain, (c) mengeksploitasi kerentanan keamanan, (d) mendistribusikan malware melalui platform, (e) menggunakan layanan untuk spam atau penipuan.',
          'Pelanggaran dapat mengakibatkan pemblokiran akun tanpa refund dan pelaporan kepada otoritas yang berwenang.',
        ],
      },
      {
        title: 'Kekayaan intelektual',
        body: [
          'Sync ERP dan logo terkait adalah merek dagang dari penyedia layanan. Konten platform dilindungi hak cipta.',
          'Data yang dimasukkan pengguna tetap menjadi milik pengguna. Sync ERP tidak mengklaim kepemilikan atas data operasional pelanggan.',
        ],
      },
      {
        title: 'Batasan tanggung jawab',
        body: [
          'Sync ERP membantu pencatatan dan workflow operasional, tetapi keputusan bisnis, akuntansi final, pajak, compliance, dan data entry tetap menjadi tanggung jawab pengguna.',
          'Tanggung jawab Sync ERP terbatas pada nilai langganan yang telah dibayarkan dalam 12 bulan terakhir.',
          'Sync ERP tidak bertanggung jawab atas kerugian tidak langsung, kehilangan keuntungan, atau kerusakan data yang disebabkan oleh kelalaian pengguna.',
        ],
      },
      {
        title: 'Yurisdiksi dan hukum yang berlaku',
        body: [
          'Syarat ini tunduk pada hukum Republik Indonesia.',
          'Sengketa akan diselesaikan terlebih melalui mediasi. Jika mediasi gagal, sengketa akan diselesaikan di pengadilan negeri yang berwenang di Indonesia.',
        ],
      },
      {
        title: 'Perubahan ketentuan',
        body: [
          'Sync ERP dapat mengubah ketentuan ini dari waktu ke waktu. Perubahan material akan diberitahukan melalui email atau notifikasi in-app minimal 30 hari sebelum berlaku.',
          'Penggunaan berkelanjutan setelah perubahan dianggap sebagai persetujuan terhadap ketentuan baru.',
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
            Terakhir diperbarui: {lastUpdated}
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

        <div className="mt-6 text-center text-sm text-slate-500">
          <p>
            Pertanyaan? Hubungi{' '}
            <a
              href={`mailto:${COMPANY_EMAIL}`}
              className="font-medium text-cyan-700 underline underline-offset-2 hover:text-cyan-800"
            >
              {COMPANY_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
