#!/usr/bin/env python3
"""Final comprehensive PDF - ALL 42 orders found + 5 without invoice."""

from fpdf import FPDF

def fmt(v):
    return f"Rp{v:,.0f}".replace(",", ".") if v else "-"

# === 26 orders from Sync ERP ===
erp = [
    ("00026", "Evi Gowok", "Gowok", "1 Agu 26", "3 Agu 26", 2, 482000, 145000, 337000, "S90x2, Bantalx3, Spreix3, Selimutx5, Kipasx2", "Paket+Add On"),
    ("00025", "Abdillah Ngestiharjo", "Ngestiharjo", "5 Jun 26", "6 Jun 26", 1, 810000, 243000, 567000, "S90x2, S100x2, D120x6, Q160x5, Kipasx2", "Paket"),
    ("00024", "Andi JaMal", "Jl. Magelang", "30 Mei 26", "1 Jun 26", 2, 965000, 290000, 675000, "S100x3, D120x5, Q160x2", "Paket"),
    ("00023", "Tri Minomartani", "Minomartani", "30 Mei 26", "1 Jun 26", 2, 430000, 129000, 301000, "S90x4, D120x1", "Paket"),
    ("00022", "Oni Prambanan", "Prambanan", "30 Mei 26", "31 Mei 26", 1, 315000, 95000, 220000, "S100x2, S90x2, Selimutx4", "Paket+Add On"),
    ("00021", "M. Lutfi Sinduharjo", "Sinduharjo", "29 Mei 26", "1 Jun 26", 3, 196000, 59000, 137000, "S100x1, Gulingx1", "Paket+Add On"),
    ("00020", "Retno Sedayu", "Royal Sedayu", "26 Mei 26", "30 Mei 26", 4, 745000, 220000, 525000, "S90x4, S100x1", "Paket"),
    ("00019", "Supriyanto Ambarketawang", "Ambarketawang", "26 Mei 26", "1 Jun 26", 6, 355000, 107000, 248000, "Q160x1", "Paket"),
    ("00018", "Meilina UMY (Tambahan)", "Dekat UMY", "25 Mei 26", "27 Mei 26", 2, 100000, 0, 100000, "S100x1", "Paket"),
    ("00017", "Meilina UMY", "Dekat UMY", "23 Mei 26", "27 Mei 26", 4, 430000, 129000, 301000, "Q160x1, D120x1, FREE guling+selimut", "Paket"),
    ("00016", "Bu Pujo Nogotirto", "Nogotirto", "21 Mei 26", "22 Mei 26", 1, 94000, 28000, 66000, "Q160x1, Bantalx2", "Paket+Add On"),
    ("00015", "Wahida Sedayu", "Sedayu", "20 Mei 26", "23 Mei 26", 3, 300000, 90000, 210000, "D120x2", "Paket"),
    ("00014", "Helena Tajem", "Kost Fortuna", "20 Mei 26", "27 Mei 26", 7, 369000, 111000, 258000, "D120x1", "Paket"),
    ("00013", "Hernawan Donoharjo", "Donoharjo", "17 Mei 26", "18 Mei 26", 1, 186000, 56000, 130000, "S90x3, Gulingx3", "Paket+Add On"),
    ("00012", "Taufik Minggir", "Minggir", "16 Mei 26", "17 Mei 26", 1, 235000, 71000, 164000, "S100x4, S90x1", "Paket"),
    ("00011", "Uwie Kraton", "Ndalem Homestay", "15 Mei 26", "16 Mei 26", 1, 90000, 27000, 63000, "S100x1, Selimutx1", "Paket+Add On"),
    ("00010", "Gissa Wedomartani", "Wedomartani", "15 Mei 26", "17 Mei 26", 2, 150000, 45000, 105000, "D120x1", "Paket"),
    ("00009", "Salsaa Sariharjo", "Sariharjo", "14 Mei 26", "17 Mei 26", 3, 375000, 113000, 262000, "Q160x2", "Paket"),
    ("00008", "Nita Seyegan", "Seyegan", "14 Mei 26", "17 Mei 26", 3, 135000, 41000, 94000, "Kasur S100x1", "Kasur Saja"),
    ("00007", "Wening Mlati", "Janturan Mlati", "14 Mei 26", "17 Mei 26", 3, 200000, 60000, 140000, "Q160x1", "Paket"),
    ("00006", "Andhi Kalya Hotel", "Kalya Hotel", "14 Mei 26", "15 Mei 26", 1, 90000, 0, 90000, "S100x1", "Paket"),
    ("00005", "Anik Ngestiharjo", "Ngestiharjo", "13 Mei 26", "15 Mei 26", 2, 125000, 38000, 87000, "Kasur Q160x1", "Kasur Saja"),
    ("00004", "Armyda Gamping", "Gamping", "9 Mei 26", "10 Mei 26", 1, 105000, 32000, 73000, "S90x2", "Paket"),
    ("00003", "Adhitama HOS Cokro", "HOS Cokro", "9 Mei 26", "10 Mei 26", 1, 185000, 56000, 129000, "S90x2, S100x2", "Paket"),
    ("00002", "Alex Seyegan", "Seyegan", "7 Mei 26", "9 Mei 26", 2, 1134000, 340000, 794000, "Q160x6, D120x4, Bantalx15, Diskon10%", "Paket+Add On"),
    ("00001", "Intan Bumijo", "Bumijo Tengah", "1 Mei 26", "3 Mei 26", 2, 210000, 63000, 147000, "D120x2", "Paket"),
]

# === 16 NEW invoices from WhatsApp ===
new_orders = [
    ("Abdul Aziz Salimi", "Godean", "15 Mar 26", "17 Mar 26", 2, 128000, 0, 128000, "Q160x1", "Paket (Lebaran)"),
    ("Abdul Aziz Salimi", "Godean", "19 Mar 26", "22 Mar 26", 3, 324000, 0, 324000, "Q160x1, D120x1", "Paket (Lebaran)"),
    ("Alfrida", "Wirogunan", "23 Mar 26", "27 Mar 26", 4, 370000, 0, 370000, "Q160x1, Bantalx4", "Paket (Lebaran)"),
    ("Antoni", "Seyegan", "20 Mar 26", "24 Mar 26", 4, 804000, 0, 804000, "D120x4", "Paket (Lebaran)"),
    ("Dzaky", "Seyegan", "26 Mar 26", "29 Mar 26", 3, 552000, 0, 552000, "Q160x3", "Paket (Lebaran)"),
    ("Fendy", "Banguntapan", "18 Mar 26", "25 Mar 26", 7, 642000, 0, 642000, "S100x2", "Paket (Lebaran)"),
    ("Fendy", "Banguntapan", "25 Mar 26", "28 Mar 26", 3, 264000, 0, 264000, "S100x2", "Paket (Lebaran)"),
    ("Felis / Ella", "Jitar Dukuh", "17 Mar 26", "23 Mar 26", 6, 644000, 300000, 344000, "Q160x1, S100x1", "Paket (Lebaran)"),
    ("Lucky Enjang", "BMT BIF Tajem", "17 Mar 26", "18 Mar 26", 1, 93000, 40000, 53000, "S90x1", "Paket (Lebaran)"),
    ("Muji", "Jakal KM19", "24 Mar 26", "25 Mar 26", 1, 320000, 0, 320000, "D120x2, S100x1, D120x2(plain), Selimutx2", "Paket (Lebaran)"),
    ("Muji", "Jakal KM19", "25 Mar 26", "26 Mar 26", 1, 252000, 0, 252000, "D120x2, S100x1, D120x2(plain), Selimutx2", "Paket (Lebaran)"),
    ("Muji", "Jakal KM19", "26 Mar 26", "27 Mar 26", 1, 252000, 0, 252000, "D120x2, S100x1, D120x2(plain), Selimutx2", "Paket (Lebaran)"),
    ("Nisrina", "Kotagede", "19 Mar 26", "23 Mar 26", 4, 518000, 0, 518000, "Q160x2", "Paket (Lebaran)"),
    ("Nawang", "Klaci 3 Seyegan", "12 Apr 26", "13 Apr 26", 1, 60000, 20000, 40000, "D120x1", "Paket"),
    ("Nawang", "Klaci 3 Seyegan", "12 Apr 26", "14 Apr 26", 2, 95000, 30000, 65000, "S100x1", "Paket"),
    ("Feris", "Greenhills Sardonoharjo", "23 Mar 26", "25 Mar 26", 2, 685000, 0, 685000, "S100x1, D120x2, Q160x3", "Paket (Lebaran)"),
    ("Zami Fatih", "Seyegan", "6 Apr 26", "10 Apr 26", 4, 205000, 0, 205000, "D120x1", "Paket"),
    ("Jhon BT", "Sidikan UH V/546", "28 Mar 26", "30 Mar 26", 2, 183000, 75000, 108000, "Q160x1, Sprei S100x1", "Paket (Lebaran)"),
    ("Harmawan", "Swantari Terrace Villa", "11 Apr 26", "12 Apr 26", 1, 145000, 45000, 100000, "S90x3", "Paket"),
    ("Aryadi", "Banguntapan Bantul", "10 Apr 26", "12 Apr 26", 2, 420000, 126000, 294000, "D120x4", "Paket"),
]

# === 5 customers without invoice ===
no_invoice = [
    ("Aries Concat", "-", "Chat tersedia, invoice tidak ditemukan"),
    ("Agashi UNY", "-", "Chat dari Feb 2026, invoice terenkripsi"),
    ("d@pi1e - Jakal KM9", "-", "Chat dari Feb 2026, invoice terenkripsi"),
    ("Harza Arbaha Wates KP", "-", "Chat tersedia, invoice tidak ditemukan"),
    ("Intan Griya Alvita", "-", "Chat tersedia, invoice tidak ditemukan"),
]


class PDF(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 13)
        self.cell(0, 7, 'SANTI LIVING - Laporan Pesanan LENGKAP', 0, 1, 'C')
        self.set_font('Helvetica', '', 8)
        self.cell(0, 4, 'Sync ERP + WhatsApp Business Web | 27 Mei 2026 | ALL DATA', 0, 1, 'C')
        self.ln(2)
    def footer(self):
        self.set_y(-12)
        self.set_font('Helvetica', 'I', 7)
        self.cell(0, 8, f'Halaman {self.page_no()}/{{nb}}', 0, 0, 'C')
    def sec(self, t):
        if self.get_y() > 250: self.add_page()
        self.set_font('Helvetica', 'B', 10)
        self.set_fill_color(41, 128, 185)
        self.set_text_color(255,255,255)
        self.cell(0, 6, f'  {t}', 0, 1, 'L', fill=True)
        self.set_text_color(0,0,0)
        self.ln(1)


def gen():
    p = PDF(); p.alias_nb_pages(); p.add_page()
    
    erp_total = sum(o[6] for o in erp)
    erp_dp = sum(o[7] for o in erp)
    erp_sisa = sum(o[8] for o in erp)
    
    new_total = sum(o[6] for o in new_orders)
    new_dp = sum(o[7] for o in new_orders)
    new_sisa = sum(o[8] for o in new_orders)
    
    grand_total = erp_total + new_total
    grand_dp = erp_dp + new_dp
    grand_sisa = erp_sisa + new_sisa
    total_orders = len(erp) + len(new_orders)
    
    # SUMMARY
    p.sec('EXECUTIVE SUMMARY')
    rows = [
        ('Total Customers (ERP)', '55'),
        ('Rental Orders di ERP', str(len(erp))),
        ('Orders dari WhatsApp (baru)', str(len(new_orders))),
        ('Total Orders Tercatat', str(total_orders)),
        ('Customer tanpa Invoice', '5'),
        ('', ''),
        ('TOTAL REVENUE', fmt(grand_total)),
        ('Total DP Terkumpul', fmt(grand_dp)),
        ('Total Sisa Pelunasan', fmt(grand_sisa)),
        ('Rata-rata per Order', fmt(grand_total // total_orders)),
        ('', ''),
        ('Kategori PAKET vs KASUR SAJA:', ''),
        ('  Orders Paket (dgn sprei+bantal)', f'{total_orders - 2} orders'),
        ('  Orders Kasur Saja (tanpa aksesoris)', '2 orders (Nita, Anik)'),
        ('  Orders Paket Lebaran (harga khusus)', '14 orders'),
    ]
    for l, v in rows:
        if not l: p.ln(1); continue
        p.set_font('Helvetica', '', 9)
        p.cell(60, 5, f'  {l}', 0, 0)
        p.set_font('Helvetica', 'B', 9)
        p.cell(0, 5, v, 0, 1)
    
    # TABLE ALL ORDERS
    p.add_page()
    p.sec(f'SEMUA RENTAL ORDERS ({total_orders} orders)')
    
    hdr = [('No', 7), ('Customer', 28), ('Lokasi', 18), ('Kirim', 13), ('Ambil', 13), ('Mlm', 7), ('Tipe', 13), ('Items', 26), ('Total', 16), ('DP', 16), ('Sisa', 16)]
    
    def draw_hdr():
        p.set_font('Helvetica', 'B', 5)
        p.set_fill_color(52, 73, 94)
        p.set_text_color(255,255,255)
        for n, w in hdr: p.cell(w, 4, n, 1, 0, 'C', fill=True)
        p.ln()
        p.set_text_color(0,0,0)
    
    draw_hdr()
    
    all_data = [(i+1, o, 'ERP') for i, o in enumerate(erp)]
    for i, o in enumerate(new_orders):
        all_data.append((len(erp)+i+1, o, 'WA'))
    
    for idx, o, src in all_data:
        if p.get_y() > 260:
            p.add_page()
            draw_hdr()
        
        if src == 'ERP':
            p.set_fill_color(236,240,241) if idx % 2 == 0 else p.set_fill_color(255,255,255)
        else:
            p.set_fill_color(255, 248, 220) if idx % 2 == 0 else p.set_fill_color(255, 252, 240)
        
        p.set_font('Helvetica', '', 5)
        vals = [str(idx), o[1][:19], o[2][:12], o[3], o[4], str(o[5]), o[10][:9] if len(o) > 10 else '-', o[9][:18], fmt(o[6]), fmt(o[7]) if o[7] else '-', fmt(o[8])]
        for (_, w), v in zip(hdr, vals):
            al = 'R' if w >= 16 and v.startswith('Rp') else 'C' if w <= 10 else 'L'
            p.cell(w, 3.5, v, 1, 0, al, fill=True)
        p.ln()
    
    # Total
    p.set_font('Helvetica', 'B', 6)
    p.set_fill_color(52, 152, 219)
    p.set_text_color(255,255,255)
    p.cell(7+28+18+13+13+7+13+26, 4, 'TOTAL', 1, 0, 'R', fill=True)
    p.cell(16, 4, fmt(grand_total), 1, 0, 'R', fill=True)
    p.cell(16, 4, fmt(grand_dp), 1, 0, 'R', fill=True)
    p.cell(16, 4, fmt(grand_sisa), 1, 0, 'R', fill=True)
    p.ln()
    p.set_text_color(0,0,0)
    
    # LEGEND
    p.ln(2)
    p.set_font('Helvetica', 'I', 6)
    p.cell(0, 4, '* Baris kuning = data dari WhatsApp (belum di Sync ERP)', 0, 1)
    p.cell(0, 4, '* "Kasur Saja" = tanpa sprei/bantal, "Paket" = lengkap dengan sprei+bantal+guling', 0, 1)
    p.cell(0, 4, '* "Paket (Lebaran)" = harga khusus Lebaran 2026 (S90=39rb, S100=44rb, D120=49rb, Q160=59rb)', 0, 1)
    p.cell(0, 4, '* "Paket+Add On" = paket standar + item tambahan (selimut, kipas, bantal extra, dll)', 0, 1)
    
    # DETAIL PER CUSTOMER
    p.add_page()
    p.sec(f'DETAIL PESANAN PER CUSTOMER ({total_orders} orders)')
    
    for idx, o, src in all_data:
        if p.get_y() > 210: p.add_page()
        
        color = (41, 128, 185) if src == 'ERP' else (230, 126, 34)
        p.set_font('Helvetica', 'B', 8)
        p.set_fill_color(*color)
        p.set_text_color(255,255,255)
        tag = ' [WhatsApp]' if src == 'WA' else ''
        p.cell(0, 5, f'  #{idx} {o[1]}{tag}', 0, 1, 'L', fill=True)
        p.set_text_color(0,0,0)
        
        p.set_font('Helvetica', '', 7.5)
        for lbl, val in [('Lokasi', o[2]), ('Kirim', o[3]), ('Ambil', o[4]), ('Durasi', f'{o[5]} malam'), ('Tipe', o[10] if len(o) > 10 else '-'), ('Items', o[9])]:
            p.cell(5, 4, '', 0, 0)
            p.cell(18, 4, f'{lbl}:', 0, 0)
            p.cell(0, 4, str(val), 0, 1)
        
        p.set_font('Helvetica', 'B', 8)
        p.cell(5, 4, '', 0, 0)
        p.cell(18, 4, 'TOTAL:', 0, 0)
        p.set_text_color(192, 57, 43)
        p.cell(0, 4, fmt(o[6]), 0, 1)
        p.set_text_color(0,0,0)
        
        if o[7]:
            p.set_font('Helvetica', '', 7)
            p.cell(5, 4, '', 0, 0)
            p.cell(18, 4, 'DP:', 0, 0)
            p.cell(0, 4, fmt(o[7]), 0, 1)
            p.cell(5, 4, '', 0, 0)
            p.cell(18, 4, 'Sisa:', 0, 0)
            p.cell(0, 4, fmt(o[8]), 0, 1)
        p.ln(3)
    
    # NO INVOICE
    p.add_page()
    p.sec('CUSTOMER TANPA INVOICE VISIBLE (5 customer)')
    p.set_font('Helvetica', '', 8)
    p.cell(0, 4, 'Customer berikut ada di WhatsApp tapi invoice tidak bisa diakses (terenkripsi/chat lama).', 0, 1)
    p.ln(2)
    
    p.set_font('Helvetica', 'B', 7)
    p.set_fill_color(231, 76, 60)
    p.set_text_color(255,255,255)
    p.cell(8, 5, 'No', 1, 0, 'C', fill=True)
    p.cell(40, 5, 'Nama', 1, 0, 'L', fill=True)
    p.cell(80, 5, 'Keterangan', 1, 1, 'L', fill=True)
    p.set_text_color(0,0,0)
    
    for i, (nama, lokasi, ket) in enumerate(no_invoice):
        p.set_fill_color(255, 235, 238) if i % 2 == 0 else p.set_fill_color(255, 245, 245)
        p.set_font('Helvetica', '', 7)
        p.cell(8, 4.5, str(i+1), 1, 0, 'C', fill=True)
        p.cell(40, 4.5, nama[:25], 1, 0, 'L', fill=True)
        p.cell(80, 4.5, ket, 1, 1, 'L', fill=True)
    
    # BREAKDOWN PER KATEGORI
    p.ln(3)
    p.sec('BREAKDOWN PER KATEGORI')
    p.set_font('Helvetica', '', 8)
    
    categories = {
        'Paket': {'count': 0, 'total': 0},
        'Paket (Lebaran)': {'count': 0, 'total': 0},
        'Paket+Add On': {'count': 0, 'total': 0},
        'Kasur Saja': {'count': 0, 'total': 0},
    }
    
    for idx, o, src in all_data:
        cat = o[10] if len(o) > 10 else 'Paket'
        if 'Kasur' in cat:
            categories['Kasur Saja']['count'] += 1
            categories['Kasur Saja']['total'] += o[6]
        elif 'Add On' in cat:
            categories['Paket+Add On']['count'] += 1
            categories['Paket+Add On']['total'] += o[6]
        elif 'Lebaran' in cat:
            categories['Paket (Lebaran)']['count'] += 1
            categories['Paket (Lebaran)']['total'] += o[6]
        else:
            categories['Paket']['count'] += 1
            categories['Paket']['total'] += o[6]
    
    p.set_font('Helvetica', 'B', 7)
    p.set_fill_color(52, 73, 94)
    p.set_text_color(255,255,255)
    p.cell(40, 5, 'Kategori', 1, 0, 'L', fill=True)
    p.cell(15, 5, 'Orders', 1, 0, 'C', fill=True)
    p.cell(25, 5, 'Revenue', 1, 0, 'R', fill=True)
    p.cell(15, 5, '% Share', 1, 1, 'C', fill=True)
    p.set_text_color(0,0,0)
    
    for cat, data in categories.items():
        if data['count'] == 0: continue
        pct = data['total'] / grand_total * 100
        p.set_fill_color(236,240,241)
        p.set_font('Helvetica', '', 7)
        p.cell(40, 4.5, cat, 1, 0, 'L', fill=True)
        p.cell(15, 4.5, str(data['count']), 1, 0, 'C', fill=True)
        p.cell(25, 4.5, fmt(data['total']), 1, 0, 'R', fill=True)
        p.cell(15, 4.5, f'{pct:.1f}%', 1, 1, 'C', fill=True)
    
    # HARGA PAKET LEBARAN vs NORMAL
    p.ln(3)
    p.set_font('Helvetica', 'B', 8)
    p.cell(0, 5, 'PERBANDINGAN HARGA:', 0, 1)
    p.set_font('Helvetica', '', 7)
    items = [
        ('Single 90 (Paket)', 'Rp35.000', 'Rp39.000', '+11%'),
        ('Single 100 (Paket)', 'Rp40.000', 'Rp44.000', '+10%'),
        ('Double 120 (Paket)', 'Rp45.000', 'Rp49.000', '+9%'),
        ('Queen 160 (Paket)', 'Rp55.000', 'Rp59.000', '+7%'),
        ('Kasur Saja Single 100', 'Rp30.000', '-', '-'),
        ('Kasur Saja Queen 160', 'Rp45.000', '-', '-'),
    ]
    p.set_fill_color(52, 73, 94)
    p.set_text_color(255,255,255)
    p.set_font('Helvetica', 'B', 6)
    p.cell(40, 4, 'Item', 1, 0, 'L', fill=True)
    p.cell(20, 4, 'Normal', 1, 0, 'C', fill=True)
    p.cell(20, 4, 'Lebaran', 1, 0, 'C', fill=True)
    p.cell(15, 4, 'Selisih', 1, 1, 'C', fill=True)
    p.set_text_color(0,0,0)
    for item, normal, lebaran, diff in items:
        p.set_fill_color(236,240,241)
        p.set_font('Helvetica', '', 6)
        p.cell(40, 4, item, 1, 0, 'L', fill=True)
        p.cell(20, 4, normal, 1, 0, 'C', fill=True)
        p.cell(20, 4, lebaran, 1, 0, 'C', fill=True)
        p.cell(15, 4, diff, 1, 1, 'C', fill=True)
    
    # RINGKASAN PER CUSTOMER (unik)
    p.add_page()
    p.sec('RINGKASAN PER CUSTOMER UNIK')
    p.set_font('Helvetica', '', 7)
    p.cell(0, 4, 'Customer dengan multiple orders dijumlahkan menjadi satu total.', 0, 1)
    p.ln(1)
    
    customer_summary = {}
    for idx, o, src in all_data:
        name = o[1]
        if name not in customer_summary:
            customer_summary[name] = {'count': 0, 'total': 0, 'dp': 0, 'sisa': 0}
        customer_summary[name]['count'] += 1
        customer_summary[name]['total'] += o[6]
        customer_summary[name]['dp'] += o[7]
        customer_summary[name]['sisa'] += o[8]
    
    # Sort by total descending
    sorted_customers = sorted(customer_summary.items(), key=lambda x: x[1]['total'], reverse=True)
    
    p.set_font('Helvetica', 'B', 6)
    p.set_fill_color(52, 73, 94)
    p.set_text_color(255,255,255)
    p.cell(8, 4, 'No', 1, 0, 'C', fill=True)
    p.cell(40, 4, 'Customer', 1, 0, 'L', fill=True)
    p.cell(10, 4, 'Ord', 1, 0, 'C', fill=True)
    p.cell(20, 4, 'Total', 1, 0, 'R', fill=True)
    p.cell(20, 4, 'DP', 1, 0, 'R', fill=True)
    p.cell(20, 4, 'Sisa', 1, 1, 'R', fill=True)
    p.set_text_color(0,0,0)
    
    for i, (name, data) in enumerate(sorted_customers):
        if p.get_y() > 260: p.add_page()
        p.set_fill_color(236,240,241) if i % 2 == 0 else p.set_fill_color(255,255,255)
        p.set_font('Helvetica', '', 6)
        p.cell(8, 4, str(i+1), 1, 0, 'C', fill=True)
        p.cell(40, 4, name[:25], 1, 0, 'L', fill=True)
        p.cell(10, 4, str(data['count']), 1, 0, 'C', fill=True)
        p.cell(20, 4, fmt(data['total']), 1, 0, 'R', fill=True)
        p.cell(20, 4, fmt(data['dp']), 1, 0, 'R', fill=True)
        p.cell(20, 4, fmt(data['sisa']), 1, 1, 'R', fill=True)
    
    # Total
    p.set_font('Helvetica', 'B', 6)
    p.set_fill_color(52, 152, 219)
    p.set_text_color(255,255,255)
    p.cell(8+40+10, 4, 'TOTAL', 1, 0, 'R', fill=True)
    p.cell(20, 4, fmt(grand_total), 1, 0, 'R', fill=True)
    p.cell(20, 4, fmt(grand_dp), 1, 0, 'R', fill=True)
    p.cell(20, 4, fmt(grand_sisa), 1, 0, 'R', fill=True)
    p.ln()
    p.set_text_color(0,0,0)
    
    out = '/tmp/whatsapp_data/Laporan_Santi_Living_LENGKAP_FINAL.pdf'
    p.output(out)
    return out

if __name__ == '__main__':
    path = gen()
    print(f'PDF: {path}')
