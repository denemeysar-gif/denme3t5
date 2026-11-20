const heroSlider = document.getElementById("heroSlider");
const searchContainer = document.getElementById("searchContainer");
const searchInput = document.getElementById("searchInput");
const categories = document.getElementById("categories");
const productList = document.getElementById("productList");
const aboutPage = document.getElementById("aboutPage");
const loadMoreBtn = document.getElementById("loadMoreBtn");

const productsPerPage = 56;
let currentIndex = 0;
let currentList = [];
let selectedCategory = null;

// SLAYT GÖSTERİSİ (Videodaki gibi akıcı otomatik geçiş)
const slides = [
    "dukkan-desktop.jpg",
    "slayt2.jpg",
    "slayt3.jpg",
    "slayt4.jpg"
];
let currentSlideIndex = 0;

function changeSlide() {
    if (!slides.length || !heroSlider) return;
    heroSlider.style.backgroundImage = `url("${slides[currentSlideIndex]}")`;
    currentSlideIndex = (currentSlideIndex + 1) % slides.length;
}
setInterval(changeSlide, 4000);
changeSlide();

const products = [
    { name: "Taç Nevresim Takımı", price: "1699 ₺", category: "Nevresim" },
    { name: "Yorgan Çift Kişilik", price: "1299 ₺", category: "Yorgan" },
    { name: "Yastık", price: "399 ₺", category: "Yastık" },
    { name: "Koltuk Örtüsü", price: "899 ₺", category: "Koltuk" },
    { name: "Taç Nevresim Takımı", price: "1699 ₺", category: "Nevresim" },
    { name: "Yorgan Çift Kişilik", price: "1299 ₺", category: "Yorgan" },
    { name: "Yastık", price: "399 ₺", category: "Yastık" },
    { name: "Koltuk Örtüsü", price: "899 ₺", category: "Koltuk" },
    { name: "Kanepe Örtüsü", price: "899 ₺", category: "Koltuk" },
    { name: "Pike Koltuk Örtüsü", price: "1399 ₺", category: "Koltuk" },
    { name: "Nevresim Takımı Tek Kişilik", price: "899 ₺", category: "Nevresim" },
    { name: "Bambu Yastık", price: "899 ₺", category: "Yastık" },
    { name: "Elyaf Yastık", price: "899 ₺", category: "Yastık" },
    { name: "Yorgan Tek Kişilik", price: "899 ₺", category: "Yorgan" },
    { name: "King Size Yorgan", price: "899 ₺", category: "Yorgan" },
    { name: "Taç Nevresim Takımı Tek Kişilik", price: "899 ₺", category: "Nevresim" },
    { name: "New Home Nevresim Takımı Çift Kişilik", price: "899 ₺", category: "Nevresim" },
    { name: "New Home Nevresim Takımı Tek Kişilik", price: "899 ₺", category: "Nevresim" },   
    { name: "Çeyizlik Bornoz Havlu Takımı", price: "1299 ₺", category:"Ceyiz"},
    { name: "Kg. Elyaf", price: "199 ₺", category:"Elyaf" },
    { name: "100 Watt Elektrikli Battaniye", price: "899 ₺", category:"Elektrikli" },
];

// ANA SAYFA
function showHome(pushHistory = true) {
    if (pushHistory) history.pushState({ page: "home" }, "", "#anasayfa");

    selectedCategory = null;
    heroSlider.style.display = "flex";
    searchContainer.style.display = "none";
    categories.style.display = "none";
    productList.style.display = "none";
    aboutPage.style.display = "none";
    loadMoreBtn.style.display = "none";
}

// TÜM ÜRÜNLER (ÜRÜNLER SEKMESİ)
function showAllProducts(pushHistory = true) {
    if (pushHistory) history.pushState({ page: "products" }, "", "#urunler");

    selectedCategory = null;
    heroSlider.style.display = "none";
    searchContainer.style.display = "block";
    categories.style.display = "grid";
    aboutPage.style.display = "none";
    productList.style.display = "none";
    loadMoreBtn.style.display = "none";

    document.querySelectorAll(".category-card").forEach(card => card.style.display = "flex");
    if (searchInput) {
        searchInput.value = "";
        searchInput.placeholder = "Kategori ara...";
    }
}

// KATEGORİ
function filterProducts(category, pushHistory = true) {
    if (pushHistory) history.pushState({ page: "category", category: category }, "", `#kategori-${category}`);

    selectedCategory = category;
    heroSlider.style.display = "none";
    searchContainer.style.display = "block";
    categories.style.display = "none";
    aboutPage.style.display = "none";
    productList.style.display = "grid";
    loadMoreBtn.style.display = "block";

    if (searchInput) {
        searchInput.value = "";
        searchInput.placeholder = "Ürün adı ara...";
    }

    currentIndex = 0;
    currentList = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    productList.innerHTML = "";
    loadMore();
}

// HAKKIMIZDA
function showAbout(pushHistory = true) {
    if (pushHistory) history.pushState({ page: "about" }, "", "#hakkimizda");

    selectedCategory = null;
    heroSlider.style.display = "none";
    searchContainer.style.display = "none";
    categories.style.display = "none";
    productList.style.display = "none";
    loadMoreBtn.style.display = "none";
    aboutPage.style.display = "block";
}

// ARAMA MOTORU
function handleSearch() {
    const query = searchInput.value.toLowerCase().trim();

    if (!selectedCategory) {
        categories.style.display = "grid";
        productList.style.display = "none";
        loadMoreBtn.style.display = "none";

        document.querySelectorAll(".category-card").forEach(card => {
            if (card.textContent.toLowerCase().includes(query)) {
                card.style.display = "flex";
            } else {
                card.style.display = "none";
            }
        });
        return;
    }

    categories.style.display = "none";
    productList.style.display = "grid";
    loadMoreBtn.style.display = "block";

    currentIndex = 0;
    const catProducts = products.filter(p => p.category.toLowerCase() === selectedCategory.toLowerCase());
    currentList = catProducts.filter(p => p.name.toLowerCase().includes(query));
    productList.innerHTML = "";
    loadMore();
}

// GERİ TUŞU DÜZELTMESİ
window.addEventListener("popstate", (event) => {
    if (event.state) {
        if (event.state.page === "home") showHome(false);
        else if (event.state.page === "products") showAllProducts(false);
        else if (event.state.page === "category") filterProducts(event.state.category, false);
        else if (event.state.page === "about") showAbout(false);
    } else {
        showHome(false);
    }
});

// DAHA FAZLA
function loadMore() {
    const slice = currentList.slice(
        currentIndex,
        currentIndex + productsPerPage
    );

    if (slice.length === 0 && currentIndex === 0) {
        productList.innerHTML = "<p style='grid-column: 1/-1; text-align:center; font-size:18px; color:#777; padding:20px;'>Bu kategoride eşleşen ürün bulunamadı.</p>";
        loadMoreBtn.style.display = "none";
        return;
    }

    slice.forEach(p => {
        productList.innerHTML += `
            <div class="product-card">
                <div class="product-img">Ürün Görseli</div>
                <div class="product-info">
                    <h3>${p.name}</h3>
                    <div class="price">${p.price}</div>
                    <button>İncele</button>
                </div>
            </div>
        `;
    });

    currentIndex += productsPerPage;

    if (currentIndex >= currentList.length) {
        loadMoreBtn.style.display = "none";
    }
}

// ===== ARKA PLAN MÜZİKLERİ (LOOP) =====
const musicList = [
    "music/1.mpeg",
    "music/2.mpeg",
    "music/3.mpeg",
    "music/4.mpeg"
];

const bgMusic = document.getElementById("bgMusic");
let musicIndex = 0;
let musicStarted = false;

function startMusicOnce() {
    if (musicStarted) return;
    musicStarted = true;

    bgMusic.src = musicList[musicIndex];
    bgMusic.volume = 0.3;
    bgMusic.play().catch(() => {});

    document.removeEventListener("click", startMusicOnce);
    document.removeEventListener("touchstart", startMusicOnce);
}

bgMusic.addEventListener("ended", () => {
    musicIndex = (musicIndex + 1) % musicList.length;
    bgMusic.src = musicList[musicIndex];
    bgMusic.play();
});

document.addEventListener("click", startMusicOnce);
document.addEventListener("touchstart", startMusicOnce);

// SAYFA AÇILIŞI
showHome(false);
