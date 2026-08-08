import { SPREADSHEET_ID, SHEET_NAMES } from "./config.js";

/**
 * Membangun URL Google Visualization API (gviz) untuk satu tab/sheet.
 * Endpoint ini bekerja selama sharing sheet diset "Anyone with the link - Viewer".
 */
function gvizUrl(sheetName) {
  const base = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq`;
  return `${base}?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
}

/**
 * Mengambil satu tab sebagai array of object, key = header kolom (baris 1 sheet).
 * Melempar Error dengan pesan jelas jika SPREADSHEET_ID belum diganti atau fetch gagal.
 */
export async function fetchSheet(sheetName) {
  if (!SPREADSHEET_ID || SPREADSHEET_ID.startsWith("GANTI_")) {
    throw new Error(
      "SPREADSHEET_ID belum diatur. Buka src/lib/config.js dan isi dengan ID Google Sheets Anda."
    );
  }

  const res = await fetch(gvizUrl(sheetName));
  if (!res.ok) {
    throw new Error(
      `Gagal mengambil data dari tab "${sheetName}" (status ${res.status}). Periksa nama tab dan pengaturan sharing sheet.`
    );
  }

  const text = await res.text();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(
      `Respons tidak dikenali dari tab "${sheetName}". Pastikan Spreadsheet ID benar dan sheet dapat diakses publik (viewer).`
    );
  }

  const data = JSON.parse(text.substring(start, end + 1));
  const cols = data.table.cols.map((c, i) => c.label || c.id || `col${i}`);

  return (data.table.rows || []).map((row) => {
    const obj = {};
    cols.forEach((label, i) => {
      const cell = row.c ? row.c[i] : null;
      obj[label] = cell && cell.v !== null && cell.v !== undefined ? cell.v : "";
    });
    return obj;
  });
}

export function formatRupiah(n) {
  const num = Number(n) || 0;
  return "Rp " + num.toLocaleString("id-ID");
}

export function formatTanggalIndo(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Mengambil edisi yang statusnya "published".
 * Jika mingguKe diberikan, cari edisi spesifik itu (dipakai untuk buka Arsip).
 * Jika tidak, kembalikan edisi dengan minggu_ke tertinggi (edisi terbaru).
 */
export async function getEdisi(mingguKe = null) {
  const rows = await fetchSheet(SHEET_NAMES.EDISI);
  const published = rows.filter((r) => String(r.status).toLowerCase() === "published");

  if (mingguKe !== null) {
    return published.find((r) => String(r.minggu_ke) === String(mingguKe)) || null;
  }

  published.sort((a, b) => Number(b.minggu_ke) - Number(a.minggu_ke));
  return published[0] || null;
}

export async function getArsipEdisi() {
  const rows = await fetchSheet(SHEET_NAMES.EDISI);
  const published = rows.filter((r) => String(r.status).toLowerCase() === "published");
  published.sort((a, b) => Number(b.minggu_ke) - Number(a.minggu_ke));
  return published;
}

export async function getJadwalByMinggu(mingguKe) {
  const rows = await fetchSheet(SHEET_NAMES.JADWAL);
  return rows.filter((r) => String(r.minggu_ke) === String(mingguKe));
}

export async function getPetugasByMinggu(mingguKe) {
  const rows = await fetchSheet(SHEET_NAMES.PETUGAS);
  return rows.filter((r) => String(r.minggu_ke) === String(mingguKe));
}

export async function getSusunanByMinggu(mingguKe) {
  const rows = await fetchSheet(SHEET_NAMES.SUSUNAN);
  return rows
    .filter((r) => String(r.minggu_ke) === String(mingguKe))
    .sort((a, b) => Number(a.no_urut) - Number(b.no_urut));
}

export async function getPokokDoaByMinggu(mingguKe) {
  const rows = await fetchSheet(SHEET_NAMES.POKOK_DOA);
  return rows.filter((r) => String(r.minggu_ke) === String(mingguKe));
}

export async function getInformasiByMinggu(mingguKe) {
  const rows = await fetchSheet(SHEET_NAMES.INFORMASI);
  return rows.filter((r) => String(r.minggu_ke) === String(mingguKe));
}

/**
 * Saldo dihitung kumulatif (bukan diketik manual): jumlah (debet - kredit)
 * seluruh baris sejak baris "Saldo Awal" pertama per kategori kas.
 * Ini menghindari human-error dari perhitungan manual mingguan.
 */
export async function getKeuanganKumulatif() {
  const rows = await fetchSheet(SHEET_NAMES.KEUANGAN);
  const kategoriOrder = [];
  const kategoris = {};

  rows.forEach((r) => {
    const kat = r.kategori_kas;
    if (!kat) return;
    if (!kategoris[kat]) {
      kategoris[kat] = { nama: kat, saldo: 0 };
      kategoriOrder.push(kat);
    }
    const debet = Number(r.debet) || 0;
    const kredit = Number(r.kredit) || 0;
    kategoris[kat].saldo += debet - kredit;
  });

  return kategoriOrder.map((k) => kategoris[k]);
}

export async function getKeuanganDetailByMinggu(kategoriKas, mingguKe) {
  const rows = await fetchSheet(SHEET_NAMES.KEUANGAN);
  return rows.filter(
    (r) => r.kategori_kas === kategoriKas && String(r.minggu_ke) === String(mingguKe)
  );
}

export async function getKontakPengurus() {
  return fetchSheet(SHEET_NAMES.KONTAK);
}
