#!/usr/bin/env python3
"""FINAL PDF - ALL 47 orders (26 ERP + 21 WhatsApp)."""

from fpdf import FPDF

def fmt(v):
    return f"Rp{v:,.0f}".replace(",", ".") if v else "-"

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

wa = [
    ("WA-01", "Abdul Aziz Salimi", "Godean", "15 Mar 26", "17 Mar 26", 2, 128000, 0, 128000, "Q160x1", "Paket (Lebaran)"),
    ("WA-02", "Abdul Aziz Salimi", "Godean", "19 Mar 26", "22 Mar 26", 3, 324000, 0, 324000, "Q160x1, D120x1", "Paket (Lebaran)"),
    ("WA-03", "Alfrida", "Wirogunan", "23 Mar 26", "27 Mar 26", 4, 370000, 0, 370000, "Q160x1, Bantalx4", "Paket (Lebaran)"),
    ("WA-04", "Antoni", "Seyegan", "20 Mar 26", "24 Mar 26", 4, 804000, 0, 804000, "D120x4", "Paket (Lebaran)"),
    ("WA-05", "Aries Nandarika", "Condongcatur", "3 Apr 26", "6 Apr 26", 3, 715000, 300000, 415000, "S100x3, S90x3", "Paket"),
    ("WA-06", "Dzaky", "Seyegan", "26 Mar 26", "29 Mar 26", 3, 552000, 0, 552000, "Q160x3", "Paket (Lebaran)"),
    ("WA-07", "Fendy", "Banguntapan", "18 Mar 26", "25 Mar 26", 7, 642000, 0, 642000, "S100x2", "Paket (Lebaran)"),
    ("WA-08", "Fendy (Perpanjangan)", "Banguntapan", "25 Mar 26", "28 Mar 26", 3, 264000, 0, 264000, "S100x2", "Paket (Lebaran)"),
    ("WA-09", "Felis / Ella", "Jitar Dukuh", "17 Mar 26", "23 Mar 26", 6, 644000, 300000, 344000, "Q160x1, S100x1", "Paket (Lebaran)"),
    ("WA-10", "Lucky Enjang", "BMT BIF Tajem", "17 Mar 26", "18 Mar 26", 1, 93000, 40000, 53000, "S90x1", "Paket (Lebaran)"),
    ("WA-11", "Muji", "Jakal KM19", "24 Mar 26", "25 Mar 26", 1, 320000, 0, 320000, "D120x2(plain), S100x1, D120x2, Selimutx2", "Paket (Lebaran)"),
    ("WA-12", "Muji", "Jakal KM19", "25 Mar 26", "26 Mar 26", 1, 252000, 0, 252000, "D120x2(plain), S100x1, D120x2, Selimutx2", "Paket (Lebaran)"),
    ("WA-13", "Muji", "Jakal KM19", "26 Mar 26", "27 Mar 26", 1, 252000, 0, 252000, "D120x2(plain), S100x1, D120x2, Selimutx2", "Paket (Lebaran)"),
    ("WA-14", "Nisrina", "Kotagede", "19 Mar 26", "23 Mar 26", 4, 518000, 0, 518000, "Q160x2", "Paket (Lebaran)"),
    ("WA-15", "Nawang", "Klaci 3 Seyegan", "12 Apr 26", "13 Apr 26", 1, 60000, 20000, 40000, "D120x1", "Paket"),
    ("WA-16", "Nawang", "Klaci 3 Seyegan", "12 Apr 26", "14 Apr 26", 2, 95000, 30000, 65000, "S100x1", "Paket"),
    ("WA-17", "Feris", "Greenhills Sardonoharjo", "23 Mar 26", "25 Mar 26", 2, 685000, 0, 685000, "S100x1, D120x2, Q160x3", "Paket (Lebaran)"),
    ("WA-18", "Zami Fatih", "Seyegan", "6 Apr 26", "10 Apr 26", 4, 205000, 0, 205000, "D120x1", "Paket"),
    ("WA-19", "Jhon BT", "Sidikan UH V/546", "28 Mar 26", "30 Mar 26", 2, 183000, 75000, 108000, "Q160x1, Sprei S100x1", "Paket (Lebaran)"),
    ("WA-20", "Harmawan", "Swantari Terrace Villa", "11 Apr 26", "12 Apr 26", 1, 145000, 45000, 100000, "S90x3", "Paket"),
    ("WA-21", "Aryadi", "Banguntapan Bantul", "10 Apr 26", "12 Apr 26", 2, 420000, 126000, 294000, "D120x4", "Paket"),
]

no_invoice = [
    ("Agashi UNY", "-", "Chat dari Feb 2026, invoice terenkripsi WhatsApp"),
    ("d@pi1e - Jakal KM9", "-", "Chat dari Feb 2026, invoice terenkripsi WhatsApp"),
    ("Harza Arbaha Wates KP", "-", "Chat dari Feb 2026, hanya ada KTP dan info bank"),
    ("Intan Griya Alvita", "-", "Chat dari Mar 2026, hanya ada ucapan terima kasih"),
]

class PDF(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 13)
        self.cell(0, 7, 'SANTI LIVING - Laporan Pesanan FINAL', 0, 1, 'C')
        self.set_font('Helvetica', '', 8)
        self.cell(0, 4, 'Sync ERP + WhatsApp Business | 27 Mei 2026 | 47 Orders', 0, 1, 'C')
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
    
    erp_t = sum(o[6] for o in erp)
    erp_dp = sum(o[7] for o in erp)
    erp_s = sum(o[8] for o in erp)
    wa_t = sum(o[6] for o in wa)
    wa_dp = sum(o[7] for o in wa)
    wa_s = sum(o[8] for o in wa)
    gt = erp_t + wa_t
    gdp = erp_dp + wa_dp
    gs = erp_s + wa_s
    total = len(erp) + len(wa)
    
    p.sec('EXECUTIVE SUMMARY')
    for l, v in [
        ('Total Customers', f'{len(set(o[1] for o in erp+wa))} unique'),
        ('Total Rental Orders', f'{total} orders'),
        ('  Dari Sync ERP', f'{len(erp)} orders (Mei-Agu 2026)'),
        ('  Dari WhatsApp (baru)', f'{len(wa)} orders (Mar-Apr 2026)'),
        ('Customer tanpa Invoice', '4 (chat terenkripsi)'),
        ('', ''),
        ('TOTAL REVENUE', fmt(gt)),
        ('  Dari ERP', fmt(erp_t)),
        ('  Dari WhatsApp', fmt(wa_t)),
        ('Total DP Terkumpul', fmt(gdp)),
        ('Total Sisa Pelunasan', fmt(gs)),
        ('Rata-rata per Order', fmt(gt // total)),
        ('', ''),
        ('KATEGORI:', ''),
        ('  Paket Standar (normal)', f'{sum(1 for o in erp+wa if o[10]=="Paket")} orders'),
        ('  Paket Lebaran 2026', f'{sum(1 for o in erp+wa if "Lebaran" in o[10])} orders'),
        ('  Paket + Add On', f'{sum(1 for o in erp+wa if "Add On" in o[10])} orders'),
        ('  Kasur Saja', f'{sum(1 for o in erp+wa if "Kasur" in o[10])} orders'),
    ]:
        if not l: p.ln(1); continue
        p.set_font('Helvetica', '', 9)
        p.cell(60, 5, f'  {l}', 0, 0)
        p.set_font('Helvetica', 'B', 9)
        p.cell(0, 5, v, 0, 1)
    
    # TABLE
    p.add_page()
    p.sec(f'SEMUA {total} RENTAL ORDERS')
    
    hdr = [('No', 6), ('Src', 6), ('Customer', 26), ('Lokasi', 16), ('Kirim', 12), ('Ambil', 12), ('Mlm', 6), ('Tipe', 14), ('Items', 24), ('Total', 16), ('DP', 16), ('Sisa', 16)]
    
    def draw_hdr():
        p.set_font('Helvetica', 'B', 5)
        p.set_fill_color(52, 73, 94)
        p.set_text_color(255,255,255)
        for n, w in hdr: p.cell(w, 4, n, 1, 0, 'C', fill=True)
        p.ln()
        p.set_text_color(0,0,0)
    
    draw_hdr()
    
    all_data = [(i+1, o, 'ERP') for i, o in enumerate(erp)]
    for i, o in enumerate(wa):
        all_data.append((len(erp)+i+1, o, 'WA'))
    
    for idx, o, src in all_data:
        if p.get_y() > 260:
            p.add_page()
            draw_hdr()
        
        if src == 'ERP':
            p.set_fill_color(236,240,241) if idx % 2 == 0 else p.set_fill_color(255,255,255)
        else:
            p.set_fill_color(255, 248, 220) if idx % 2 == 0 else p.set_fill_color(255, 252, 240)
        
        p.set_font('Helvetica', '', 4.5)
        vals = [str(idx), src, o[1][:18], o[2][:11], o[3], o[4], str(o[5]), o[10][:10], o[9][:17], fmt(o[6]), fmt(o[7]) if o[7] else '-', fmt(o[8])]
        for (_, w), v in zip(hdr, vals):
            al = 'R' if w >= 16 and v.startswith('Rp') else 'C' if w <= 7 else 'L'
            p.cell(w, 3.5, v, 1, 0, al, fill=True)
        p.ln()
    
    # Total
    p.set_font('Helvetica', 'B', 5)
    p.set_fill_color(52, 152, 219)
    p.set_text_color(255,255,255)
    span = sum(w for _, w in hdr[:9])
    p.cell(span, 4, 'TOTAL', 1, 0, 'R', fill=True)
    p.cell(16, 4, fmt(gt), 1, 0, 'R', fill=True)
    p.cell(16, 4, fmt(gdp), 1, 0, 'R', fill=True)
    p.cell(16, 4, fmt(gs), 1, 0, 'R', fill=True)
    p.ln()
    p.set_text_color(0,0,0)
    p.ln(1)
    p.set_font('Helvetica', 'I', 6)
    p.cell(0, 4, '* Baris kuning = data dari WhatsApp (belum di Sync ERP)', 0, 1)
    p.cell(0, 4, '* "Paket" = kasur+sprei+bantal | "Kasur Saja" = tanpa aksesoris | "Paket+Add On" = paket+item tambahan', 0, 1)
    p.cell(0, 4, '* Harga Lebaran: S90=39rb, S100=44rb, D120=49rb, Q160=59rb per malam', 0, 1)
    
    # NO INVOICE
    p.add_page()
    p.sec('CUSTOMER TANPA INVOICE (4)')
    p.set_font('Helvetica', '', 8)
    p.cell(0, 4, 'Customer ada di WhatsApp tapi invoice tidak bisa diakses (terenkripsi/chat lama):', 0, 1)
    p.ln(1)
    for i, (n, l, k) in enumerate(no_invoice):
        p.set_font('Helvetica', '', 7)
        p.cell(0, 4, f'  {i+1}. {n} - {k}', 0, 1)
    
    # BREAKDOWN
    p.ln(3)
    p.sec('BREAKDOWN PER KATEGORI')
    cats = {}
    for o in erp + wa:
        c = o[10]
        if c not in cats: cats[c] = {'n': 0, 't': 0}
        cats[c]['n'] += 1
        cats[c]['t'] += o[6]
    
    p.set_font('Helvetica', 'B', 6)
    p.set_fill_color(52, 73, 94)
    p.set_text_color(255,255,255)
    p.cell(35, 4, 'Kategori', 1, 0, 'L', fill=True)
    p.cell(12, 4, 'Orders', 1, 0, 'C', fill=True)
    p.cell(20, 4, 'Revenue', 1, 0, 'R', fill=True)
    p.cell(12, 4, '% Share', 1, 1, 'C', fill=True)
    p.set_text_color(0,0,0)
    for c, d in sorted(cats.items(), key=lambda x: -x[1]['t']):
        p.set_fill_color(236,240,241)
        p.set_font('Helvetica', '', 6)
        p.cell(35, 4, c, 1, 0, 'L', fill=True)
        p.cell(12, 4, str(d['n']), 1, 0, 'C', fill=True)
        p.cell(20, 4, fmt(d['t']), 1, 0, 'R', fill=True)
        p.cell(12, 4, f'{d["t"]/gt*100:.1f}%', 1, 1, 'C', fill=True)
    
    # HARGA
    p.ln(2)
    p.set_font('Helvetica', 'B', 7)
    p.cell(0, 5, 'HARGA PER MALAM:', 0, 1)
    p.set_font('Helvetica', '', 6)
    for item, n, l in [
        ('Single 90 (Paket)', 'Rp35.000', 'Rp39.000'),
        ('Single 100 (Paket)', 'Rp40.000', 'Rp44.000'),
        ('Double 120 (Paket)', 'Rp45.000', 'Rp49.000'),
        ('Queen 160 (Paket)', 'Rp55.000', 'Rp59.000'),
        ('Kasur Saja S100', 'Rp30.000', '-'),
        ('Kasur Saja Q160', 'Rp45.000', '-'),
    ]:
        p.cell(0, 4, f'  {item}: Normal {n} | Lebaran {l}', 0, 1)
    
    # CUSTOMER SUMMARY
    p.add_page()
    p.sec('RINGKASAN PER CUSTOMER UNIK')
    cust = {}
    for o in erp + wa:
        n = o[1]
        if n not in cust: cust[n] = {'c': 0, 't': 0, 'd': 0, 's': 0}
        cust[n]['c'] += 1
        cust[n]['t'] += o[6]
        cust[n]['d'] += o[7]
        cust[n]['s'] += o[8]
    
    sorted_c = sorted(cust.items(), key=lambda x: -x[1]['t'])
    
    p.set_font('Helvetica', 'B', 6)
    p.set_fill_color(52, 73, 94)
    p.set_text_color(255,255,255)
    p.cell(6, 4, '#', 1, 0, 'C', fill=True)
    p.cell(38, 4, 'Customer', 1, 0, 'L', fill=True)
    p.cell(8, 4, 'Ord', 1, 0, 'C', fill=True)
    p.cell(20, 4, 'Total', 1, 0, 'R', fill=True)
    p.cell(20, 4, 'DP', 1, 0, 'R', fill=True)
    p.cell(20, 4, 'Sisa', 1, 1, 'R', fill=True)
    p.set_text_color(0,0,0)
    
    for i, (n, d) in enumerate(sorted_c):
        if p.get_y() > 260: p.add_page()
        p.set_fill_color(236,240,241) if i % 2 == 0 else p.set_fill_color(255,255,255)
        p.set_font('Helvetica', '', 5.5)
        p.cell(6, 3.5, str(i+1), 1, 0, 'C', fill=True)
        p.cell(38, 3.5, n[:24], 1, 0, 'L', fill=True)
        p.cell(8, 3.5, str(d['c']), 1, 0, 'C', fill=True)
        p.cell(20, 3.5, fmt(d['t']), 1, 0, 'R', fill=True)
        p.cell(20, 3.5, fmt(d['d']), 1, 0, 'R', fill=True)
        p.cell(20, 3.5, fmt(d['s']), 1, 1, 'R', fill=True)
    
    p.set_font('Helvetica', 'B', 6)
    p.set_fill_color(52, 152, 219)
    p.set_text_color(255,255,255)
    p.cell(6+38+8, 4, f'TOTAL ({len(cust)} customers)', 1, 0, 'R', fill=True)
    p.cell(20, 4, fmt(gt), 1, 0, 'R', fill=True)
    p.cell(20, 4, fmt(gdp), 1, 0, 'R', fill=True)
    p.cell(20, 4, fmt(gs), 1, 0, 'R', fill=True)
    p.ln()
    p.set_text_color(0,0,0)
    
    out = '/tmp/whatsapp_data/Laporan_Santi_Living_FINAL.pdf'
    p.output(out)
    return out

if __name__ == '__main__':
    path = gen()
    print(f'PDF: {path}')
