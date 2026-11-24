const GOMULU_VERI = null;
const SUPABASE_URL = "https://SENIN_PROJE_ID.supabase.co";
const SUPABASE_KEY = "SENIN_ANON_PUBLIC_KEY";

const HAFIZA_ORAN = "ertu_fiyat_oran_ayar_v7";
const VARSAYILAN_KULLANICILAR = [
    { id: "yonetici", ad: "Yönetici (Tüm Alanlar)", sifre: "1234", kod: true, barkod: true, aciklama: true, alis: true, f1: true, f2: true, f3: true, f4: true },
    { id: "plasiyer", ad: "Satış Personeli (Satış 1)", sifre: "1111", kod: true, barkod: true, aciklama: false, alis: false, f1: true, f2: false, f3: false, f4: false }
];

let aktifFirmaKodu = "ertu", aktifFirmaAdi = "Ertu Ticaret";
let urunler = [], kullanicilar = VARSAYILAN_KULLANICILAR, adminSifre = "1234", aktifKullanici = null, yonetimAcik = false;
let aktifKameraStream = null, barkodTaramaTimer = null;
let siralamaAlan = '', siralamaYon = 1;
const seciliIdler = new Set();

function bulutDurumGuncelle(metin, renk) {
    const el = document.getElementById('bulutDurumEtiket');
    if (el) { el.innerText = metin; el.style.color = renk; }
}

function supabaseAktifMi() {
    return !GOMULU_VERI && SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("SENIN_PROJE");
}

function yereldenHizliYukle(kod) {
    if (GOMULU_VERI && Array.isArray(GOMULU_VERI.urunler)) {
        urunler = GOMULU_VERI.urunler;
        kullanicilar = GOMULU_VERI.kullanicilar || VARSAYILAN_KULLANICILAR;
        adminSifre = GOMULU_VERI.adminSifre || "1234";
        aktifFirmaAdi = GOMULU_VERI.firmaAdi || "Çevrimdışı Liste";
        document.getElementById('girisFirmaBaslik').innerText = aktifFirmaAdi;
        document.getElementById('anaFirmaBaslik').innerText = aktifFirmaAdi;
        girisListesiniDoldur();
        return;
    }
    try {
        const yerel = JSON.parse(localStorage.getItem("ertu_veri_" + kod));
        if (yerel) {
            urunler = yerel.urunler || [];
            kullanicilar = (yerel.kullanicilar && yerel.kullanicilar.length) ? yerel.kullanicilar : VARSAYILAN_KULLANICILAR;
            adminSifre = yerel.adminSifre || "1234";
            if (yerel.firmaAdi) {
                aktifFirmaAdi = yerel.firmaAdi;
                document.getElementById('girisFirmaBaslik').innerText = aktifFirmaAdi;
                document.getElementById('anaFirmaBaslik').innerText = aktifFirmaAdi;
            }
        }
    } catch (e) {}
    girisListesiniDoldur();
}

async function verileriKaydet() {
    const paket = { urunler, kullanicilar, adminSifre, firmaAdi: aktifFirmaAdi };
    try { localStorage.setItem("ertu_veri_" + aktifFirmaKodu, JSON.stringify(paket)); } catch (e) {}
    if (!supabaseAktifMi()) { bulutDurumGuncelle("💾 Yerel Mod", "#d97706"); return; }

    bulutDurumGuncelle("⏳ Kaydediliyor...", "#2563eb");
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/firmalar_sistem?firma_kodu=eq.${encodeURIComponent(aktifFirmaKodu)}`, {
            method: "PATCH",
            headers: {
                "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY,
                "Content-Type": "application/json", "Prefer": "return=minimal"
            },
            body: JSON.stringify({ veri: paket, guncelleme: new Date().toISOString() })
        });
        bulutDurumGuncelle(res.ok ? "☁️ Bulut Güncel" : "⚠️ Bulut Hatası", res.ok ? "#15803d" : "#dc2626");
    } catch (e) { bulutDurumGuncelle("⚠️ Bağlantı Yok", "#dc2626"); }
}

async function firmaVerisiniYukle(sessiz = false) {
    const kodInput = document.getElementById('girisFirmaKodu');
    const kod = (kodInput ? kodInput.value : aktifFirmaKodu).toLocaleLowerCase('tr-TR').trim();
    if (!kod) { document.getElementById('girisHata').innerText = "Lütfen firma kodu girin."; return; }
    aktifFirmaKodu = kod;
    yereldenHizliYukle(kod);

    if (!supabaseAktifMi()) { document.getElementById('girisHata').innerText = ""; return; }
    if (!sessiz) document.getElementById('girisHata').innerText = "Bulut kontrol ediliyor...";

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/firmalar_sistem?firma_kodu=eq.${encodeURIComponent(kod)}&select=*`, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
        });
        const liste = await res.json();
        const data = Array.isArray(liste) ? liste.at(0) : null;

        if (!data) {
            if (!sessiz) document.getElementById('girisHata').innerText = "Firma bulunamadı! Kodu kontrol edin.";
            return;
        }
        if (data.aktif === false) {
            document.getElementById('girisHata').innerText = "Bu firmanın erişimi pasif durumdadır.";
            return;
        }

        aktifFirmaAdi = data.firma_adi || kod.toUpperCase();
        document.getElementById('girisFirmaBaslik').innerText = aktifFirmaAdi;
        document.getElementById('anaFirmaBaslik').innerText = aktifFirmaAdi;

        const v = data.veri || {};
        urunler = Array.isArray(v.urunler) ? v.urunler : [];
        kullanicilar = (Array.isArray(v.kullanicilar) && v.kullanicilar.length > 0) ? v.kullanicilar : VARSAYILAN_KULLANICILAR;
        adminSifre = v.adminSifre || "1234";
        try { localStorage.setItem("ertu_veri_" + kod, JSON.stringify({ urunler, kullanicilar, adminSifre, firmaAdi: aktifFirmaAdi })); } catch (e) {}
        document.getElementById('girisHata').innerText = "";
        girisListesiniDoldur();
        if (aktifKullanici) tabloyuGuncelle();
    } catch (e) {
        if (!sessiz) document.getElementById('girisHata').innerText = "";
    }
}

async function buluttanYenile() {
    bulutDurumGuncelle("⏳ Yenileniyor...", "#2563eb");
    await firmaVerisiniYukle(true);
    bulutDurumGuncelle("☁️ Güncellendi", "#15803d");
}

function sekmeDegistir(sekmeAdi) {
    ['urun', 'personel', 'firma'].forEach(s => {
        const icerik = document.getElementById('sekme_' + s);
        const btn = document.getElementById('tabBtn_' + s);
        if (icerik) icerik.classList.toggle('active', s === sekmeAdi);
        if (btn) btn.classList.toggle('active', s === sekmeAdi);
    });
    if (sekmeAdi === 'firma') firmalariListele();
}

function oranAyarKaydet() {
    const ayar = {
        baz_f1: document.getElementById('baz_f1').value, oran_f1: document.getElementById('oran_f1').value,
        baz_f2: document.getElementById('baz_f2').value, oran_f2: document.getElementById('oran_f2').value,
        baz_f3: document.getElementById('baz_f3').value, oran_f3: document.getElementById('oran_f3').value,
        baz_f4: document.getElementById('baz_f4').value, oran_f4: document.getElementById('oran_f4').value,
        yuvarlama: document.getElementById('yuvarlamaSec').value
    };
    try { localStorage.setItem(HAFIZA_ORAN, JSON.stringify(ayar)); } catch (e) {}
    yeniUrunOtomatikHesapla();
}

function oranAyarYukle() {
    try {
        const kayitli = JSON.parse(localStorage.getItem(HAFIZA_ORAN));
        if (!kayitli) return;
        ['baz_f1','oran_f1','baz_f2','oran_f2','baz_f3','oran_f3','baz_f4','oran_f4'].forEach(k => {
            if (kayitli[k] !== undefined) document.getElementById(k).value = kayitli[k];
        });
        if (kayitli.yuvarlama !== undefined) document.getElementById('yuvarlamaSec').value = kayitli.yuvarlama;
    } catch (e) {}
}

function yukariYuvarla(deger, adim) {
    const sayi = Number(deger) || 0;
    if (sayi <= 0) return 0;
    const kat = Number(adim) || 0;
    if (kat <= 0) return Math.round(sayi * 100) / 100;
    return Math.ceil(sayi / kat) * kat;
}

function kademeliFiyatUret(alisDegeri) {
    const adim = document.getElementById('yuvarlamaSec').value;
    const degerler = { alis: Number(alisDegeri) || 0, f1: 0, f2: 0, f3: 0, f4: 0 };
    ['f1', 'f2', 'f3', 'f4'].forEach(k => {
        const bazAlan = document.getElementById('baz_' + k).value;
        const oran = parseFloat(document.getElementById('oran_' + k).value) || 0;
        const bazFiyat = degerler[bazAlan] || 0;
        degerler[k] = yukariYuvarla(bazFiyat * (1 + oran / 100), adim);
    });
    return degerler;
}

function yeniUrunOtomatikHesapla() {
    const alis = parseFloat(document.getElementById('alisFiyat').value);
    if (isNaN(alis) || alis <= 0) return;
    const sonuc = kademeliFiyatUret(alis);
    document.getElementById('satisFiyat1').value = sonuc.f1;
    document.getElementById('satisFiyat2').value = sonuc.f2;
    document.getElementById('satisFiyat3').value = sonuc.f3;
    document.getElementById('satisFiyat4').value = sonuc.f4;
}

function sirala(alan) {
    if (siralamaAlan === alan) {
        siralamaYon = -siralamaYon;
    } else {
        siralamaAlan = alan;
        siralamaYon = 1;
    }
    ['kod', 'barkod', 'isim', 'aciklama', 'alis', 'f1', 'f2', 'f3', 'f4', 'gizli'].forEach(k => {
        const sp = document.getElementById('srt_' + k);
        if (sp) sp.innerText = (k === siralamaAlan) ? (siralamaYon === 1 ? '▲' : '▼') : '';
    });
    tabloyuGuncelle();
}

function filtreliUrunleriGetir() {
    const arama = document.getElementById('aramaKutusu').value.toLocaleLowerCase('tr-TR').trim();
    const kelimeler = arama.split(/\s+/).filter(Boolean);
    const gizliGorebilir = aktifKullanici && (aktifKullanici.id === 'yonetici' || aktifKullanici.alis);
    const sadeceGizliCheck = document.getElementById('sadeceGizlilerCheck');
    const sadeceGizli = gizliGorebilir && sadeceGizliCheck && sadeceGizliCheck.checked;

    const sonuc = urunler.filter(u => {
        if (u.gizli && !gizliGorebilir) return false;
        if (sadeceGizli && !u.gizli) return false;
        if (kelimeler.length === 0) return true;
        const metin = `${u.kod || ''} ${u.barkod || ''} ${u.isim || ''} ${u.aciklama || ''}`.toLocaleLowerCase('tr-TR');
        return kelimeler.every(k => metin.includes(k));
    });

    if (siralamaAlan) {
        const sayisalMi = ['alis', 'f1', 'f2', 'f3', 'f4'].includes(siralamaAlan);
        sonuc.sort((a, b) => {
            if (siralamaAlan === 'gizli') return ((a.gizli ? 1 : 0) - (b.gizli ? 1 : 0)) * siralamaYon;
            if (sayisalMi) return ((Number(a[siralamaAlan]) || 0) - (Number(b[siralamaAlan]) || 0)) * siralamaYon;
            const valA = String(a[siralamaAlan] || '');
            const valB = String(b[siralamaAlan] || '');
            return valA.localeCompare(valB, 'tr', { numeric: true }) * siralamaYon;
        });
    }
    return sonuc;
}

function topluGizleDurum(gizleMi) {
    const hedefListe = filtreliUrunleriGetir();
    if (hedefListe.length === 0) { alert("Listede işlem yapılacak ürün yok!"); return; }
    if (!confirm(`Ekranda listelenen ${hedefListe.length} ürün ${gizleMi ? "personelden GİZLENECEK" : "personele AÇILACAK"}. Onaylıyor musunuz?`)) return;
    hedefListe.forEach(u => { u.gizli = gizleMi; });
    verileriKaydet(); tabloyuGuncelle();
}

function tekilGizleDegistir(id, durum) {
    const u = urunler.find(x => x.id === id);
    if (!u) return;
    u.gizli = durum;
    verileriKaydet(); tabloyuGuncelle();
}

function topluFiyatHesaplaUygula() {
    const hedefListe = filtreliUrunleriGetir();
    if (hedefListe.length === 0) { alert("Listede uygulanacak ürün yok!"); return; }
    if (!confirm(`Ekranda listelenen ${hedefListe.length} ürünün satış fiyatları seçtiğiniz oranlara göre güncellenecek. Onaylıyor musunuz?`)) return;
    let guncellenen = 0;
    hedefListe.forEach(u => {
        if (!u.alis || u.alis <= 0) return;
        const yeni = kademeliFiyatUret(u.alis);
        u.f1 = yeni.f1; u.f2 = yeni.f2; u.f3 = yeni.f3; u.f4 = yeni.f4;
        guncellenen++;
    });
    verileriKaydet(); tabloyuGuncelle();
    alert(`${guncellenen} ürünün fiyatları güncellendi!`);
}

function karMarjiRozeti(alis, satis) {
    const a = Number(alis) || 0, s = Number(satis) || 0;
    if (a <= 0 || s <= 0) return `<span class="marj-rozet"></span>`;
    const yuzde = Math.round(((s - a) / a) * 100);
    return `<span class="marj-rozet" style="font-size:10px;font-weight:700;color:${yuzde >= 0 ? '#15803d' : '#dc2626'};margin-left:3px;">(${yuzde >= 0 ? '+' : ''}%${yuzde})</span>`;
}

function girisListesiniDoldur() {
    document.getElementById('girisKullaniciSec').innerHTML = kullanicilar.map(k => `<option value="${k.id}">${k.ad}</option>`).join('');
}

function girisYap() {
    const secilenId = document.getElementById('girisKullaniciSec').value;
    const girilenSifre = document.getElementById('girisSifreInput').value.trim();
    const kullanici = kullanicilar.find(k => k.id === secilenId);
    if (!kullanici || kullanici.sifre !== girilenSifre) { document.getElementById('girisHata').innerText = "Hatalı şifre! Tekrar deneyin."; return; }
    aktifKullanici = kullanici; yonetimAcik = false;
    document.getElementById('girisEkrani').style.display = 'none';
    document.getElementById('anaEkran').style.display = 'block';
    document.getElementById('aktifKullaniciEtiket').innerText = kullanici.ad;
    document.getElementById('btnYonetim').style.display = kullanici.id === 'yonetici' ? 'inline-block' : 'none';
    document.getElementById('tabBtn_firma').style.display = (kullanici.id === 'yonetici' && aktifFirmaKodu === 'ertu') ? 'inline-block' : 'none';
    const gizliKutu = document.getElementById('gizliFiltreKutu');
    if (gizliKutu) {
        gizliKutu.style.display = (kullanici.id === 'yonetici' || kullanici.alis) ? 'flex' : 'none';
        document.getElementById('sadeceGizlilerCheck').checked = false;
    }
    document.getElementById('yonetimPaneli').style.display = 'none';
    document.getElementById('btnYonetim').innerText = 'Yönetim';
    sekmeDegistir('urun');
    oranAyarYukle(); kullaniciListesiniCiz(); tabloyuGuncelle();
}

function cikisYap() {
    aktifKullanici = null;
    document.getElementById('girisSifreInput').value = '';
    document.getElementById('girisHata').innerText = '';
    document.getElementById('anaEkran').style.display = 'none';
    document.getElementById('girisEkrani').style.display = 'flex';
}

function yonetimPaneliAcKapat() {
    yonetimAcik = !yonetimAcik;
    document.getElementById('yonetimPaneli').style.display = yonetimAcik ? 'block' : 'none';
    document.getElementById('btnYonetim').innerText = yonetimAcik ? 'Yönetimi Kapat' : 'Yönetim';
    tabloyuGuncelle();
}

function sifreGuncelle() {
    const yeni = document.getElementById('yeniAdminSifre').value.trim();
    if (!yeni) { alert("Yeni şifre boş olamaz."); return; }
    adminSifre = yeni;
    const yonetici = kullanicilar.find(k => k.id === "yonetici");
    if (yonetici) { yonetici.sifre = yeni; verileriKaydet(); }
    document.getElementById('yeniAdminSifre').value = '';
    alert("Yönetici şifresi güncellendi!");
}

function kullaniciKaydet() {
    const ad = document.getElementById('yeniKullaniciAdi').value.trim();
    const sifre = document.getElementById('yeniKullaniciSifre').value.trim();
    if (!ad || !sifre) { alert("Personel adı ve şifre zorunludur!"); return; }
    kullanicilar.push({
        id: "kul_" + Date.now(), ad, sifre,
        kod: document.getElementById('yetki_kod').checked,
        barkod: document.getElementById('yetki_barkod').checked,
        aciklama: document.getElementById('yetki_aciklama').checked,
        alis: document.getElementById('yetki_alis').checked,
        f1: document.getElementById('yetki_f1').checked, f2: document.getElementById('yetki_f2').checked,
        f3: document.getElementById('yetki_f3').checked, f4: document.getElementById('yetki_f4').checked
    });
    verileriKaydet();
    document.getElementById('yeniKullaniciAdi').value = ''; document.getElementById('yeniKullaniciSifre').value = '';
    kullaniciListesiniCiz(); alert("Personel eklendi.");
}

function kullaniciSil(id) {
    if (id === "yonetici") { alert("Ana yönetici silinemez."); return; }
    if (!confirm("Bu personel silinsin mi?")) return;
    kullanicilar = kullanicilar.filter(k => k.id !== id);
    verileriKaydet(); kullaniciListesiniCiz();
}

function kullaniciListesiniCiz() {
    document.getElementById('kullaniciListesi').innerHTML = kullanicilar.map(k => {
        const y = [];
        if (k.kod !== false) y.push("Stok Kodu"); if (k.barkod !== false) y.push("Barkod");
        if (k.aciklama) y.push("Açıklama"); if (k.alis) y.push("Alış");
        if (k.f1) y.push("Satış 1"); if (k.f2) y.push("Satış 2"); if (k.f3) y.push("Satış 3"); if (k.f4) y.push("Satış 4");
        return `<div class="user-item"><span><strong>${k.ad}</strong> (Şifre: ${k.sifre}) — <em>${y.join(', ') || 'Yetki Yok'}</em></span>${k.id !== 'yonetici' ? `<button class="btn-sm-del" onclick="kullaniciSil('${k.id}')">Sil</button>` : ''}</div>`;
    }).join('');
}

async function firmalariListele() {
    const kutu = document.getElementById('firmaListesiKutu');
    if (!supabaseAktifMi()) { kutu.innerHTML = '<div class="user-item">Bulut bağlantısı aktif değil.</div>'; return; }
    kutu.innerHTML = '<div class="user-item">Firmalar yükleniyor...</div>';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/firmalar_sistem?select=firma_kodu,firma_adi,aktif&order=firma_kodu.asc`, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
        });
        const liste = await res.json();
        if (!Array.isArray(liste) || liste.length === 0) { kutu.innerHTML = '<div class="user-item">Kayıtlı firma yok.</div>'; return; }
        const temelUrl = window.location.origin + window.location.pathname;
        kutu.innerHTML = liste.map(f => {
            const link = `${temelUrl}?firma=${f.firma_kodu}`;
            const durumBtn = f.firma_kodu === 'ertu' ? '' : `<button type="button" class="${f.aktif ? 'btn-warn' : 'btn-success'}" style="padding:4px 8px;font-size:11px;" onclick="firmaDurumDegistir('${f.firma_kodu}', ${!f.aktif})">${f.aktif ? 'Pasif Yap' : 'Aktif Yap'}</button>`;
            return `<div class="user-item">
                <span><strong>${f.firma_adi}</strong> (Kod: <code>${f.firma_kodu}</code>) — <em>${f.aktif ? '🟢 Aktif' : '🔴 Pasif'}</em></span>
                <span style="display:flex;gap:4px;">
                    <button type="button" class="btn-info" style="padding:4px 8px;font-size:11px;" onclick="navigator.clipboard.writeText('${link}');alert('Firma giriş linki kopyalandı:\\n${link}')">📋 Link Kopyala</button>
                    ${durumBtn}
                </span>
            </div>`;
        }).join('');
    } catch (e) { kutu.innerHTML = '<div class="user-item">Firmalar alınamadı.</div>'; }
}

async function yeniFirmaOlustur() {
    if (!supabaseAktifMi()) { alert("Önce Supabase anahtarlarını bağlamalısınız."); return; }
    const kod = document.getElementById('yeniFirmaKodu').value.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9_-]/g, '').trim();
    const ad = document.getElementById('yeniFirmaAdi').value.trim();
    const sifre = document.getElementById('yeniFirmaSifre').value.trim() || "1234";
    if (!kod || !ad) { alert("Firma kodu ve ünvanı zorunludur!"); return; }
    const ilkVeri = {
        urunler: [],
        kullanicilar: [
            { id: "yonetici", ad: "Yönetici (Tüm Alanlar)", sifre: sifre, kod: true, barkod: true, aciklama: true, alis: true, f1: true, f2: true, f3: true, f4: true },
            { id: "plasiyer", ad: "Satış Personeli (Satış 1)", sifre: "1111", kod: true, barkod: true, aciklama: false, alis: false, f1: true, f2: false, f3: false, f4: false }
        ],
        adminSifre: sifre
    };
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/firmalar_sistem`, {
            method: "POST",
            headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", "Prefer": "return=minimal" },
            body: JSON.stringify({ firma_kodu: kod, firma_adi: ad, veri: ilkVeri, aktif: true })
        });
        if (!res.ok) { alert("Firma eklenemedi! Bu kod zaten kullanılıyor olabilir."); return; }
        document.getElementById('yeniFirmaKodu').value = ''; document.getElementById('yeniFirmaAdi').value = '';
        alert(`"${ad}" firması başarıyla oluşturuldu!`); firmalariListele();
    } catch (e) { alert("Bağlantı hatası oluştu."); }
}

async function firmaDurumDegistir(kod, yeniDurum) {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/firmalar_sistem?firma_kodu=eq.${encodeURIComponent(kod)}`, {
            method: "PATCH",
            headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", "Prefer": "return=minimal" },
            body: JSON.stringify({ aktif: yeniDurum })
        });
        firmalariListele();
    } catch (e) {}
}

function urunEkle() {
    const isim = document.getElementById('urunIsmi').value.trim();
    if (!isim) { alert("Ürün ismi zorunludur!"); return; }
    urunler.unshift({
        id: Date.now() + Math.random(),
        kod: document.getElementById('stokKodu').value.trim(), barkod: document.getElementById('barkod').value.trim(),
        isim: isim, aciklama: document.getElementById('urunAciklama').value.trim(),
        alis: parseFloat(document.getElementById('alisFiyat').value) || 0,
        f1: parseFloat(document.getElementById('satisFiyat1').value) || 0, f2: parseFloat(document.getElementById('satisFiyat2').value) || 0,
        f3: parseFloat(document.getElementById('satisFiyat3').value) || 0, f4: parseFloat(document.getElementById('satisFiyat4').value) || 0,
        gizli: document.getElementById('yeniUrunGizli').checked
    });
    verileriKaydet();
    ['stokKodu', 'barkod', 'urunIsmi', 'urunAciklama', 'alisFiyat', 'satisFiyat1', 'satisFiyat2', 'satisFiyat3', 'satisFiyat4'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('yeniUrunGizli').checked = false; tabloyuGuncelle();
}

function urunSil(id) {
    if (!confirm("Bu ürün silinsin mi?")) return;
    urunler = urunler.filter(u => u.id !== id);
    seciliIdler.delete(id);
    seciliSayacGuncelle();
    verileriKaydet(); tabloyuGuncelle();
}

function satirFiyatGuncelle(id, alan, inputEl) {
    const urun = urunler.find(u => u.id === id);
    if (!urun) return;
    const yeniDeger = parseFloat(inputEl.value.replace(',', '.')) || 0;
    if (urun[alan] !== yeniDeger) {
        urun[alan] = yeniDeger;
        verileriKaydet();
        inputEl.classList.add('inline-saved');
        setTimeout(() => inputEl.classList.remove('inline-saved'), 600);
        const tr = inputEl.closest('tr');
        if (tr && aktifKullanici && aktifKullanici.alis) {
            tr.querySelectorAll('input[data-alan]').forEach(inp => {
                const a = inp.dataset.alan;
                if (a !== 'alis' && inp.nextElementSibling && inp.nextElementSibling.classList.contains('marj-rozet')) {
                    inp.nextElementSibling.outerHTML = karMarjiRozeti(urun.alis, urun[a]);
                }
            });
        }
    }
}

function satirAciklamaGuncelle(id, inputEl) {
    const urun = urunler.find(u => u.id === id);
    if (!urun) return;
    const yeniNot = inputEl.value.trim();
    if ((urun.aciklama || '') !== yeniNot) {
        urun.aciklama = yeniNot;
        verileriKaydet();
        inputEl.classList.add('inline-saved');
        setTimeout(() => inputEl.classList.remove('inline-saved'), 800);
    }
}

function fiyatFormat(sayi) {
    return (Number(sayi) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}

function aramayiTemizle() {
    document.getElementById('aramaKutusu').value = '';
    const chk = document.getElementById('sadeceGizlilerCheck');
    if (chk) chk.checked = false;
    tabloyuGuncelle();
}

function sesliAramaBaslat() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Tarayıcınız sesli aramayı desteklemiyor (Chrome veya Safari kullanın)."); return; }
    const btn = document.getElementById('btnSesliArama');
    const aramaInput = document.getElementById('aramaKutusu');
    const tanima = new SpeechRecognition();
    tanima.lang = 'tr-TR'; tanima.interimResults = false; tanima.maxAlternatives = 1;
    tanima.onstart = () => { btn.classList.add('dinliyor'); aramaInput.placeholder = "Dinleniyor... Ürün adını söyleyin"; };
    tanima.onresult = (event) => {
        aramaInput.value = event.results.item(0).item(0).transcript.replace(/[.,!?]+$/g, '').trim();
        tabloyuGuncelle();
    };
    tanima.onerror = (event) => { if (event.error === 'not-allowed') alert("Mikrofon izni verilmedi."); };
    tanima.onend = () => { btn.classList.remove('dinliyor'); aramaInput.placeholder = "Ürün ismi, kod, barkod, ses veya kamera..."; };
    tanima.start();
}

function ocrKutuphanesiYukle() {
    return new Promise((resolve, reject) => {
        if (window.Tesseract) { resolve(); return; }
        const sc = document.createElement('script');
        sc.src = "https://jsdelivr.net";
        sc.onload = () => resolve();
        sc.onerror = () => reject();
        document.head.appendChild(sc);
    });
}

async function kamerayiAc() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Tarayıcınız kamera erişimini desteklemiyor veya güvenli bağlantı (HTTPS) gerekiyor."); return;
    }
    const modal = document.getElementById('kameraModal');
    const video = document.getElementById('kameraVideo');
    const durum = document.getElementById('kameraDurum');
    modal.style.display = 'flex';
    durum.innerText = "Kamera açılıyor... Barkodu yaklaştırın veya yazı okutun.";
    try {
        aktifKameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        video.srcObject = aktifKameraStream;
        if ('BarcodeDetector' in window) {
            const detector = new BarcodeDetector();
            barkodTaramaTimer = setInterval(async () => {
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    try {
                        const barkodlar = await detector.detect(video);
                        if (barkodlar && barkodlar.length > 0 && barkodlar.item(0).rawValue) {
                            document.getElementById('aramaKutusu').value = barkodlar.item(0).rawValue;
                            kamerayiKapat(); tabloyuGuncelle();
                        }
                    } catch (e) {}
                }
            }, 400);
        } else {
            durum.innerText = "Otomatik barkod tarayıcı bu tarayıcıda yok; aşağıdaki 'Ürün İsmini / Yazıyı Oku' butonunu kullanın.";
        }
    } catch (err) {
        durum.innerText = "Kamera açılamadı! İzin verildiğinden emin olun.";
    }
}

function kamerayiKapat() {
    if (barkodTaramaTimer) { clearInterval(barkodTaramaTimer); barkodTaramaTimer = null; }
    if (aktifKameraStream) { aktifKameraStream.getTracks().forEach(t => t.stop()); aktifKameraStream = null; }
    document.getElementById('kameraModal').style.display = 'none';
}

async function etiketMetniOku() {
    const video = document.getElementById('kameraVideo');
    const canvas = document.getElementById('kameraCanvas');
    const durum = document.getElementById('kameraDurum');
    if (!video.videoWidth) { durum.innerText = "Kamera görüntüsü henüz hazır değil."; return; }
    durum.innerText = "⏳ Yazı okuma motoru hazırlanıyor ve etiket okunuyor...";
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
        await ocrKutuphanesiYukle();
        const sonuc = await window.Tesseract.recognize(canvas, 'tur');
        const temizYazi = (sonuc.data.text || '').replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s-]/g, ' ').replace(/\s+/g, ' ').trim();
        if (temizYazi.length >= 2) {
            document.getElementById('aramaKutusu').value = temizYazi;
            kamerayiKapat(); tabloyuGuncelle();
        } else {
            durum.innerText = "❌ Yazı net okunamadı, kamerayı yaklaştırıp tekrar deneyin.";
        }
    } catch (e) { durum.innerText = "Okuma sırasında hata oluştu (İnternet bağlantısını kontrol edin)."; }
}

function seciliSayacGuncelle() {
    document.querySelectorAll('.seciliSayi').forEach(el => el.innerText = seciliIdler.size);
}

function tekilSecDegistir(id, seciliMi) {
    if (seciliMi) seciliIdler.add(id);
    else seciliIdler.delete(id);
    seciliSayacGuncelle();
}

function tumunuSecDegistir(seciliMi) {
    const filtreli = filtreliUrunleriGetir();
    filtreli.forEach(u => {
        if (seciliMi) seciliIdler.add(u.id);
        else seciliIdler.delete(u.id);
    });
    document.querySelectorAll('.satir-sec-chk').forEach(chk => chk.checked = seciliMi);
    seciliSayacGuncelle();
}

function tabloyuGuncelle() {
    if (!aktifKullanici) return;
    const govde = document.getElementById('urunListesiGovde');
    const kodYetki = aktifKullanici.kod !== false;
    const barkodYetki = aktifKullanici.barkod !== false;
    const aciklamaYetki = (aktifKullanici.id === 'yonetici') || Boolean(aktifKullanici.aciklama);

    document.getElementById('th_kod').classList.toggle('hidden-col', !kodYetki);
    document.getElementById('th_barkod').classList.toggle('hidden-col', !barkodYetki);
    document.getElementById('th_aciklama').classList.toggle('hidden-col', !aciklamaYetki);
    ['alis', 'f1', 'f2', 'f3', 'f4'].forEach(k => document.getElementById('th_' + k).classList.toggle('hidden-col', !aktifKullanici[k]));
    document.getElementById('th_gizli').classList.toggle('hidden-col', !yonetimAcik);
    document.getElementById('th_islem').classList.toggle('hidden-col', !yonetimAcik);

    const filtreli = filtreliUrunleriGetir();
    document.getElementById('urunSayaci').innerText = filtreli.length;
    const hedefSpan = document.getElementById('hedefUrunSayisi');
    if (hedefSpan) hedefSpan.innerText = filtreli.length;
    const marjGoster = aktifKullanici.alis;

    govde.innerHTML = filtreli.map(u => {
        const satirSinif = u.gizli ? 'row-hidden-staff' : '';
        const gizliEtiket = u.gizli ? '<span class="hidden-badge">🙈 Gizli</span>' : '';
        const masaustuHucre = (alan, yetki, sinif) => {
            if (!yetki) return '';
            const marj = (alan !== 'alis' && marjGoster) ? karMarjiRozeti(u.alis, u[alan]) : '';
            if (yonetimAcik) {
                const inputSinif = alan === 'alis' ? 'inline-price-input buy-input' : 'inline-price-input';
                return `<td class="text-right desktop-col"><input type="number" step="0.01" inputmode="decimal" data-alan="${alan}" class="${inputSinif}" value="${u[alan] || 0}" onchange="satirFiyatGuncelle(${u.id}, '${alan}', this)" onkeydown="if(event.key==='Enter') this.blur()">${marj}</td>`;
            }
            return `<td class="text-right desktop-col ${sinif}">${fiyatFormat(u[alan])}${marj}</td>`;
        };
        const mobilFiyatOgesi = (alan, yetki, isAlis) => {
            if (!yetki) return '';
            const marj = (!isAlis && marjGoster) ? karMarjiRozeti(u.alis, u[alan]) : '';
            if (yonetimAcik) {
                const inputSinif = isAlis ? 'inline-price-input buy-input' : 'inline-price-input';
                return `<input type="number" step="0.01" inputmode="decimal" data-alan="${alan}" class="${inputSinif}" value="${u[alan] || 0}" onchange="satirFiyatGuncelle(${u.id}, '${alan}', this)" onkeydown="if(event.key==='Enter') this.blur()">${marj}`;
            }
            return `<span class="${isAlis ? 'm-badge m-badge-buy' : 'm-badge'}">${fiyatFormat(u[alan])}${marj}</span>`;
        };
        const masaustuAciklama = yonetimAcik
            ? `<input type="text" class="inline-note-input" placeholder="Not yazın..." value="${(u.aciklama || '').replace(/"/g, '&quot;')}" onchange="satirAciklamaGuncelle(${u.id}, this)" onkeydown="if(event.key==='Enter') this.blur()">`
            : (u.aciklama || '-');
        const mobilAciklama = !aciklamaYetki ? '' : (yonetimAcik
            ? `<input type="text" class="inline-note-input" placeholder="Açıklama / Not ekle..." value="${(u.aciklama || '').replace(/"/g, '&quot;')}" onchange="satirAciklamaGuncelle(${u.id}, this)" onkeydown="if(event.key==='Enter') this.blur()">`
            : (u.aciklama ? `📝 ${u.aciklama}` : ''));

        return `<tr class="${satirSinif}">
            <td style="text-align:center;"><input type="checkbox" class="satir-sec-chk" value="${u.id}" ${seciliIdler.has(u.id) ? 'checked' : ''} onchange="tekilSecDegistir(${u.id}, this.checked)"></td>
            ${kodYetki ? `<td class="desktop-col">${u.kod ? `<span class="code-tag">${u.kod}</span>` : '-'}</td>` : ''}
            ${barkodYetki ? `<td class="desktop-col">${u.barkod || '-'}</td>` : ''}
            <td class="product-name-cell"><span>${u.isim}${gizliEtiket}</span>${yonetimAcik ? `<span style="display:flex;gap:4px;align-items:center;"><label class="mobile-del-btn" style="font-size:11px;background:#fef3c7;padding:3px 6px;border-radius:4px;"><input type="checkbox" ${u.gizli ? 'checked' : ''} onchange="tekilGizleDegistir(${u.id}, this.checked)"> Gizle</label><button class="btn-sm-del mobile-del-btn" onclick="urunSil(${u.id})">Sil</button></span>` : ''}</td>
            ${aciklamaYetki ? `<td class="desktop-col">${masaustuAciklama}</td>` : ''}
            ${masaustuHucre('alis', aktifKullanici.alis, 'price-buy')}
            ${masaustuHucre('f1', aktifKullanici.f1, 'price-sell')}
            ${masaustuHucre('f2', aktifKullanici.f2, 'price-sell')}
            ${masaustuHucre('f3', aktifKullanici.f3, 'price-sell')}
            ${masaustuHucre('f4', aktifKullanici.f4, 'price-sell')}
            ${yonetimAcik ? `<td class="text-center desktop-col col-action"><input type="checkbox" ${u.gizli ? 'checked' : ''} onchange="tekilGizleDegistir(${u.id}, this.checked)" title="Personelden Gizle"></td>` : ''}
            ${yonetimAcik ? `<td class="text-right desktop-col col-action"><button class="btn-sm-del" onclick="urunSil(${u.id})">Sil</button></td>` : ''}
            ${mobilAciklama ? `<td class="mobile-note-box">${mobilAciklama}</td>` : ''}
            <td class="mobile-price-row">
                ${mobilFiyatOgesi('alis', aktifKullanici.alis, true)}
                ${mobilFiyatOgesi('f1', aktifKullanici.f1, false)}
                ${mobilFiyatOgesi('f2', aktifKullanici.f2, false)}
                ${mobilFiyatOgesi('f3', aktifKullanici.f3, false)}
                ${mobilFiyatOgesi('f4', aktifKullanici.f4, false)}
            </td>
        </tr>`;
    }).join('');
}

function listeyiTemizle() {
    if (!confirm("TÜM ürünler kalıcı olarak silinecek. Emin misiniz?")) return;
    urunler = []; seciliIdler.clear(); seciliSayacGuncelle();
    verileriKaydet(); tabloyuGuncelle();
}

function sablonIndir() {
    const csv = "\uFEFFStok Kodu;Barkod;Ürün İsmi;Açıklama;Alış Fiyat;Satış 1;Satış 2;Satış 3;Satış 4\nSTK-01;869000000001;Örnek Ürün;Açıklama;100.00;150.00;140.00;130.00;120.00";
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })); a.download = "fiyat_listesi_sablon.csv"; a.click();
}

function indirilecekListeyiAl(sadeceSecilenler) {
    if (sadeceSecilenler) {
        const secilenListe = urunler.filter(u => seciliIdler.has(u.id));
        if (secilenListe.length === 0) { alert("Lütfen önce tablodan en az bir ürün işaretleyin!"); return null; }
        return secilenListe;
    }
    return filtreliUrunleriGetir();
}

function excelAktar(sadeceSecilenler = false) {
    const liste = indirilecekListeyiAl(sadeceSecilenler);
    if (!liste) return;
    if (liste.length === 0) { alert("İndirilecek ürün bulunamadı!"); return; }
    let csv = "\uFEFFStok Kodu;Barkod;Ürün İsmi;Açıklama;Alış Fiyat;Satış 1;Satış 2;Satış 3;Satış 4\n";
    liste.forEach(u => { csv += `${u.kod || ''};${u.barkod || ''};${u.isim || ''};${u.aciklama || ''};${u.alis || 0};${u.f1 || 0};${u.f2 || 0};${u.f3 || 0};${u.f4 || 0}\n`; });
    const etiket = sadeceSecilenler ? "Secilenler" : "Fiyat_Listesi";
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })); a.download = `${aktifFirmaKodu}_${etiket}_${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

function pdfAktar(sadeceSecilenler = false) {
    const liste = indirilecekListeyiAl(sadeceSecilenler);
    if (!liste) return;
    if (liste.length === 0) { alert("PDF oluşturulacak ürün bulunamadı!"); return; }
    const k = aktifKullanici || {};
    const tarih = new Date().toLocaleDateString('tr-TR');
    const baslik = aktifFirmaAdi + " - " + (sadeceSecilenler ? "Seçili Ürünler Fiyat Listesi" : "Fiyat Listesi");

    const satirlarHtml = liste.map((u, idx) => {
        let s = "<tr><td>" + (idx + 1) + "</td>";
        if (k.kod !== false) s += "<td>" + (u.kod || "-") + "</td>";
        if (k.barkod !== false) s += "<td>" + (u.barkod || "-") + "</td>";
        s += "<td><strong>" + (u.isim || "") + "</strong></td>";
        if (k.aciklama) s += "<td>" + (u.aciklama || "-") + "</td>";
        if (k.alis) s += "<td class='num'>" + fiyatFormat(u.alis) + "</td>";
        if (k.f1) s += "<td class='num'>" + fiyatFormat(u.f1) + "</td>";
        if (k.f2) s += "<td class='num'>" + fiyatFormat(u.f2) + "</td>";
        if (k.f3) s += "<td class='num'>" + fiyatFormat(u.f3) + "</td>";
        if (k.f4) s += "<td class='num'>" + fiyatFormat(u.f4) + "</td>";
        return s + "</tr>";
    }).join("");

    const pencere = window.open("", "_blank");
    if (!pencere) { alert("Açılır pencere (Pop-up) engellendi. Lütfen tarayıcıdan izin verin."); return; }

    let baslikHtml = "<th>#</th>";
    if (k.kod !== false) baslikHtml += "<th>Stok Kodu</th>";
    if (k.barkod !== false) baslikHtml += "<th>Barkod</th>";
    baslikHtml += "<th>Ürün İsmi</th>";
    if (k.aciklama) baslikHtml += "<th>Açıklama</th>";
    if (k.alis) baslikHtml += "<th class='num'>Alış</th>";
    if (k.f1) baslikHtml += "<th class='num'>Satış 1</th>";
    if (k.f2) baslikHtml += "<th class='num'>Satış 2</th>";
    if (k.f3) baslikHtml += "<th class='num'>Satış 3</th>";
    if (k.f4) baslikHtml += "<th class='num'>Satış 4</th>";

    pencere.document.write("<!DOCTYPE html><html lang='tr'><head><meta charset='UTF-8'><title>" + baslik + "</title>" +
        "<style>body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;margin:15px}" +
        ".ust{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1e3a8a;padding-bottom:8px;margin-bottom:12px}" +
        ".ust h2{margin:0;color:#1e3a8a;font-size:16px}" +
        "table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:5px 6px;text-align:left}" +
        "th{background:#f1f5f9;color:#1e3a8a;font-weight:bold}tr:nth-child(even){background:#f8fafc}" +
        ".num{text-align:right;white-space:nowrap;font-weight:bold}@media print{.no-print{display:none}}</style></head>" +
        "<body><div class='ust'><div><h2>" + baslik + "</h2><small>Toplam " + liste.length + " ürün listelendi</small></div>" +
        "<div style='text-align:right'><strong>Tarih: " + tarih + "</strong><br>" +
        "<button class='no-print' onclick='window.print()' style='margin-top:4px;padding:5px 10px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer'>🖨️ Yazdır / PDF Kaydet</button></div></div>" +
        "<table><thead><tr>" + baslikHtml + "</tr></thead><tbody>" + satirlarHtml + "</tbody></table>" +
        "<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>");
    pencere.document.close();
}

function exceldenYukle(event) {
    const dosya = event.target.files.item(0); if (!dosya) return;
    const okuyucu = new FileReader();
    okuyucu.onload = function(e) {
        let metin = new TextDecoder("utf-8").decode(e.target.result);
        if (metin.includes("\uFFFD")) metin = new TextDecoder("windows-1254").decode(e.target.result);
        const satirlar = metin.split(/\r?\n/).filter(s => s.trim() !== "");
        if (satirlar.length < 2) { alert("Dosya boş veya sadece başlık satırı var!"); return; }
        const ilkSatir = satirlar.shift();
        const ayrac = ilkSatir.includes(';') ? ';' : (ilkSatir.includes('\t') ? '\t' : ',');
        const temizMetin = (d) => (d || '').replace(/^"|"$/g, '').trim();
        const temizSayi = (d) => {
            let ham = temizMetin(d).replace(/[₺TL\s]/gi, '');
            ham = (ham.includes('.') && ham.includes(',')) ? ham.replace(/\./g, '').replace(',', '.') : ham.replace(',', '.');
            return parseFloat(ham) || 0;
        };
        let eklenen = 0;
        for (const satir of satirlar) {
            const [hamKod, hamBarkod, hamIsim, hamAciklama, hamAlis, hamF1, hamF2, hamF3, hamF4] = satir.split(ayrac);
            const kod = temizMetin(hamKod), barkod = temizMetin(hamBarkod), isim = temizMetin(hamIsim);
            if (isim || kod) {
                urunler.push({
                    id: Date.now() + Math.random(), kod, barkod, isim: isim || kod, aciklama: temizMetin(hamAciklama),
                    alis: temizSayi(hamAlis), f1: temizSayi(hamF1), f2: temizSayi(hamF2), f3: temizSayi(hamF3), f4: temizSayi(hamF4), gizli: false
                });
                eklenen++;
            }
        }
        verileriKaydet(); tabloyuGuncelle(); alert(`${eklenen} ürün başarıyla yüklendi!`); event.target.value = "";
    };
    okuyucu.readAsArrayBuffer(dosya);
}

function verileriYedekle() {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify({ urunler, kullanicilar, adminSifre }, null, 2)], { type: "application/json" })); a.download = `${aktifFirmaKodu}_Yedek_${new Date().toISOString().slice(0,10)}.json`; a.click();
}

function verileriGeriYukle(event) {
    const dosya = event.target.files.item(0); if (!dosya) return;
    const okuyucu = new FileReader();
    okuyucu.onload = function(e) {
        try {
            const d = JSON.parse(e.target.result);
            if (d.urunler) urunler = d.urunler; if (d.kullanicilar) kullanicilar = d.kullanicilar; if (d.adminSifre) adminSifre = d.adminSifre;
            verileriKaydet(); girisListesiniDoldur(); tabloyuGuncelle(); alert("Veriler başarıyla yüklendi!");
        } catch (err) { alert("Dosya okunamadı."); }
        event.target.value = "";
    };
    okuyucu.readAsText(dosya);
}

async function veriliHtmlIndir() {
    if (urunler.length === 0) { alert("Listede hiç ürün yok! Önce ürün ekleyin."); return; }
    let cssMetin = "", jsMetin = "";
    try {
        const [cssRes, jsRes] = await Promise.all([fetch('style.css'), fetch('script.js')]);
        cssMetin = await cssRes.text();
        jsMetin = await jsRes.text();
    } catch (e) {
        for (const sheet of document.styleSheets) {
            try { for (const rule of sheet.cssRules) cssMetin += rule.cssText + "\n"; } catch (err) {}
        }
        for (const sc of document.scripts) {
            if (!sc.src) jsMetin += sc.textContent + "\n";
        }
    }
    const paket = JSON.stringify({ urunler, kullanicilar, adminSifre, firmaAdi: aktifFirmaAdi });
    const klon = document.documentElement.cloneNode(true);
    klon.querySelector('#girisEkrani').style.display = 'flex';
    klon.querySelector('#anaEkran').style.display = 'none';
    klon.querySelector('#yonetimPaneli').style.display = 'none';
    klon.querySelector('#btnYonetim').innerText = 'Yönetim';
    klon.querySelector('#urunListesiGovde').innerHTML = '';

    if (cssMetin) {
        const cssLink = klon.querySelector('link[href="style.css"]');
        if (cssLink) { const st = document.createElement('style'); st.textContent = cssMetin; cssLink.replaceWith(st); }
    }
    if (jsMetin) {
        jsMetin = jsMetin.replace(/const GOMULU_VERI = [\s\S]*?;/, `const GOMULU_VERI = ${paket};`);
        const jsScript = klon.querySelector('script[src="script.js"]');
        if (jsScript) { const sc = document.createElement('script'); sc.textContent = jsMetin; jsScript.replaceWith(sc); }
    } else {
        klon.querySelectorAll('script').forEach(sc => {
            if (sc.textContent.includes('const GOMULU_VERI')) {
                sc.textContent = sc.textContent.replace(/const GOMULU_VERI = [\s\S]*?;/, `const GOMULU_VERI = ${paket};`);
            }
        });
    }
    const kaynakHtml = "<!DOCTYPE html>\n" + klon.outerHTML;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([kaynakHtml], { type: "text/html;charset=utf-8;" }));
    link.download = `${aktifFirmaKodu}_Fiyat_Mobil_${new Date().toISOString().slice(0,10)}.html`;
    link.click();
}

document.addEventListener('wheel', function() {
    if (document.activeElement && document.activeElement.type === 'number') document.activeElement.blur();
}, { passive: true });

window.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlFirma = urlParams.get('firma');
    if (urlFirma) {
        aktifFirmaKodu = urlFirma.toLocaleLowerCase('tr-TR').trim();
        const fInput = document.getElementById('girisFirmaKodu');
        if (fInput) fInput.value = aktifFirmaKodu;
    }
    yereldenHizliYukle(aktifFirmaKodu);
    firmaVerisiniYukle(true);
});

