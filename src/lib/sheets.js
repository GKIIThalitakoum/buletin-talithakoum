import { PUBLISHED_BASE_URL, SHEET_GIDS } from "./config.js";

function csvUrl(gid) {
  return `${PUBLISHED_BASE_URL}?output=csv&gid=${encodeURIComponent(gid)}`;
}

/**
 * Parser CSV ringan (menangani field berisi koma/tanda kutip, sesuai RFC4180).
 * Diperlukan karena banyak nilai (nama petugas, dsb.) mengandung koma.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\r") {
        // skip
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/**
 * Mengambil satu tab (berdasarkan gid) sebagai array of object,
 * key = header kolom (baris 1 sheet).
 */
export async function fetchSheet(gidKey) {
  const gid = SHEET_GIDS[gidKey];

  if (!gid || String(gid).startsWith("GANTI_")) {
    throw new Error(
      `GID untuk "${gidKey}" belum diatur. Buka src/lib/config.js dan isi SHEET_GIDS.`
    );
  }

  const res = await fetch(csvUrl(gid));
  if (!res.ok) {
    throw new Error(
      `Gagal mengambil data (status ${res.status}). Periksa apakah sheet masih "Published to web".`
    );
  }

  const text = await res.text();
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const headers = rows[0];
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = r[i] !== undefined ? r[i] : "";
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

export function formatJam(jamInput) {
  if (jamInput === "" || jamInput === null || jamInput === undefined) return "";
  const num = Number(jamInput);
  if (isNaN(num)) return String(jamInput);
  return num.toString().padStart(2, "0") + ".00 WITA";
}

/**
 * Mengambil edisi yang statusnya "published".
 * Jika mingguKe diberikan, cari edisi spesifik itu (dipakai untuk buka Arsip).
 * Jika tidak, kembalikan edisi dengan minggu_ke tertinggi (edisi terbaru).
 */
export async function getEdisi(mingguKe = null) {
  const rows = await fetchSheet("EDISI");
  const published = rows.filter((r) => String(r.status).toLowerCase().trim() === "published");

  if (mingguKe !== null) {
    return published.find((r) => String(r.minggu_ke) === String(mingguKe)) || null;
  }

  published.sort((a, b) => Number(b.minggu_ke) - Number(a.minggu_ke));
  return published[0] || null;
}

export async function getArsipEdisi() {
  const rows = await fetchSheet("EDISI");
  const published = rows.filter((r) => String(r.status).toLowerCase().trim() === "published");
  published.sort((a, b) => Number(b.minggu_ke) - Number(a.minggu_ke));
  return published;
}

export async function getJadwalByMinggu(mingguKe) {
  const rows = await fetchSheet("JADWAL");
  return rows.filter((r) => String(r.minggu_ke) === String(mingguKe));
}

export async function getPetugasByMinggu(mingguKe) {
  const rows = await fetchSheet("PETUGAS");
  return rows.filter((r) => String(r.minggu_ke) === String(mingguKe));
}

export async function getSusunanByMinggu(mingguKe) {
  const rows = await fetchSheet("SUSUNAN");
  return rows
    .filter((r) => String(r.minggu_ke) === String(mingguKe))
    .sort((a, b) => Number(a.no_urut) - Number(b.no_urut));
}

export async function getPokokDoaByMinggu(mingguKe) {
  const rows = await fetchSheet("POKOK_DOA");
  return rows.filter((r) => String(r.minggu_ke) === String(mingguKe));
}

export async function getInformasiByMinggu(mingguKe) {
  const rows = await fetchSheet("INFORMASI");
  return rows.filter((r) => String(r.minggu_ke) === String(mingguKe));
}

/**
 * Saldo dihitung kumulatif (bukan diketik manual): jumlah (debet - kredit)
 * seluruh baris sejak baris "Saldo Awal" pertama per kategori kas.
 */
export async function getKeuanganKumulatif() {
  const rows = await fetchSheet("KEUANGAN");
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
  const rows = await fetchSheet("KEUANGAN");
  return rows.filter(
    (r) => r.kategori_kas === kategoriKas && String(r.minggu_ke) === String(mingguKe)
  );
}

export async function getKontakPengurus() {
  return fetchSheet("KONTAK");
}
