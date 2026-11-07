// ==========================================
// F5 STORE - MAIN JAVASCRIPT
// Firebase Authentication + Firestore + Uploadcare HLS
// Account sharing + Video download/share + Feedback lightbox
// ==========================================

// FIREBASE 
const firebaseConfig = {
  apiKey: "AIzaSyA8o1-dnkcTf1k1eWRbNYOQHb-RjR2i_yo",
  authDomain: "f5-store.firebaseapp.com",
  projectId: "f5-store",
  storageBucket: "f5-store.firebasestorage.app",
  messagingSenderId: "494735190451",
  appId: "1:494735190451:web:af05e91c97d723e2d4c3c6",
  measurementId: "G-WM9ZFDNZKQ"
};

const ADMIN_UID = "Rxr5eOiDdcT2JVTSf2vfEvCQSmJ3";
const WHATSAPP_NUMBER = "96181607574";
const ADMIN_PAGE_URL = "admin.html";

const FIREBASE_VERSION = "10.12.2";
const FIREBASE_BASE =
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const $ = (id) => document.getElementById(id);

// ==========================================
// GLOBAL STATE
// ==========================================

const modal = $("adminModal");
const statusEl = $("loginStatus");
const loginButton = $("loginButton");

let auth = null;
let authModule = null;
let firestoreModule = null;

let firebaseReady = false;
let firebaseApp = null;
let db = null;

let accountsUnsubscribe = null;
let selectedAccount = null;
let currentAdminUser = null;

let detailsHls = null;
let previewObserver = null;
let sharedAccountOpened = false;

let revealObserver = null;

// Video action buttons
const downloadVideoButton = $("downloadAccountVideo");
const shareVideoButton = $("shareAccountVideo");

// Feedback lightbox elements
const feedbackLightbox = $("feedbackLightbox");
const feedbackLightboxImage = $("feedbackLightboxImage");
const closeFeedbackLightboxButton = $("closeFeedbackLightbox");

// ==========================================
// STATUS
// ==========================================

function setStatus(message, type = "error") {
  if (!statusEl) {
    console.log(message);
    return;
  }

  statusEl.textContent = message;
  statusEl.className = `login-status ${type}`;
}

function goToAdminPage() {
  window.location.href = ADMIN_PAGE_URL;
}

// ==========================================
// WHATSAPP
// ==========================================

function sendWhatsAppMessage(message) {
  const url =
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  window.open(url, "_blank", "noopener,noreferrer");
}

function openWhatsApp(uc, price) {
  const message =
    `Hi F5 STORE! I want to buy the PUBG Mobile ${uc} package for $${price}. My Player ID is: `;

  sendWhatsAppMessage(message);
}

document.querySelectorAll(".package-card").forEach((card) => {
  card.addEventListener("click", () => {
    const uc = card.dataset.uc;
    const price = card.dataset.price;

    if (uc && price) {
      openWhatsApp(uc, price);
    }
  });
});

// ==========================================
// FOOTER YEAR
// ==========================================

if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}

// ==========================================
// MOBILE MENU
// ==========================================

if ($("menuToggle") && $("nav")) {
  $("menuToggle").addEventListener("click", () => {
    const isOpen = $("nav").classList.toggle("open");

    $("menuToggle").setAttribute(
      "aria-expanded",
      String(isOpen)
    );
  });
}

document.querySelectorAll(".nav a").forEach((link) => {
  link.addEventListener("click", () => {
    $("nav")?.classList.remove("open");
    $("menuToggle")?.setAttribute("aria-expanded", "false");
  });
});

// ==========================================
// SCROLL ANIMATIONS
// ==========================================

function observeRevealElements(container = document) {
  if (!("IntersectionObserver" in window)) {
    container.querySelectorAll(".reveal").forEach((element) => {
      element.classList.add("visible");
    });
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
  }

  container.querySelectorAll(".reveal:not(.visible)").forEach((element) => {
    revealObserver.observe(element);
  });
}

observeRevealElements();

// ==========================================
// ADMIN LOGIN MODAL
// ==========================================

function showModal() {
  if (!modal) return;

  if (currentAdminUser?.uid === ADMIN_UID) {
    goToAdminPage();
    return;
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function hideModal() {
  if (!modal) return;

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

$("openAdmin")?.addEventListener("click", showModal);
$("closeAdmin")?.addEventListener("click", hideModal);

modal?.addEventListener("click", (event) => {
  if (event.target === modal) hideModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideModal();
    closeAccountDetails();
    closeFeedbackLightbox();
  }
});

// ==========================================
// ACCOUNT ELEMENTS
// ==========================================

const accountsGrid = $("accountsGrid");
const accountsLoading = $("accountsLoading");
const accountsEmpty = $("accountsEmpty");
const accountsError = $("accountsError");

const accountDetailsModal = $("accountDetailsModal");
const accountDetailsVideo = $("accountDetailsVideo");
const accountDetailsVideoPlaceholder =
  $("accountDetailsVideoPlaceholder");

const accountDetailsTitle = $("accountDetailsTitle");
const accountDetailsDescription = $("accountDetailsDescription");
const accountDetailsPrice = $("accountDetailsPrice");
const accountDetailsWhatsApp = $("accountDetailsWhatsApp");
const accountDetailsShare = $("accountDetailsShare");

// ==========================================
// ACCOUNT LOADING MESSAGES
// ==========================================

function showAccountsLoading() {
  if (accountsLoading) {
    accountsLoading.hidden = false;
    accountsLoading.style.display = "block";
  }

  if (accountsEmpty) accountsEmpty.hidden = true;
  if (accountsError) accountsError.hidden = true;
}

function hideAccountsLoading() {
  if (accountsLoading) {
    accountsLoading.hidden = true;
    accountsLoading.style.display = "none";
  }
}

function showAccountsEmpty() {
  if (accountsEmpty) {
    accountsEmpty.hidden = false;
    accountsEmpty.style.display = "block";
  }
}

function showAccountsError() {
  hideAccountsLoading();

  if (accountsError) {
    accountsError.hidden = false;
    accountsError.style.display = "block";
  }
}

// ==========================================
// PRICE FORMAT
// ==========================================

function formatAccountPrice(price) {
  if (price === undefined || price === null || price === "") {
    return "Contact us";
  }

  return `$${price}`;
}

// ==========================================
// ACCOUNT SHARE URL
// ==========================================

function getAccountShareUrl(accountId) {
  const url = new URL(window.location.href);
  url.searchParams.set("account", accountId);
  return url.toString();
}

// ==========================================
// COPY LINK FALLBACK
// ==========================================

async function copyTextFallback(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textArea = document.createElement("textarea");

  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, text.length);

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch (error) {
    console.warn("Clipboard fallback failed:", error);
  }

  textArea.remove();

  if (copied) return true;

  window.prompt("Copy this link:", text);
  return false;
}

// ==========================================
// SHARE ACCOUNT
// ==========================================

async function shareSelectedAccount() {
  if (!selectedAccount?.id) {
    alert("Please open an account before sharing.");
    return;
  }

  const shareUrl = getAccountShareUrl(selectedAccount.id);

  const shareData = {
    title: selectedAccount.title || "F5 STORE PUBG Account",
    text: `Check out ${selectedAccount.title || "this PUBG account"} on F5 STORE.`,
    url: shareUrl
  };

  if (typeof navigator.share === "function") {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("Native sharing unavailable:", error);
    }
  }

  try {
    const copied = await copyTextFallback(shareUrl);

    if (copied) {
      alert("Account link copied successfully!");
    }
  } catch (error) {
    console.error("Could not share account link:", error);
    window.prompt("Copy this account link:", shareUrl);
  }
}

if (accountDetailsShare) {
  accountDetailsShare.type = "button";

  accountDetailsShare.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    shareSelectedAccount();
  });
} else {
  console.error(
    'Share button not found. Check id="accountDetailsShare".'
  );
}

// ==========================================
// VIDEO URL HELPERS
// ==========================================

function getAdaptiveVideoUrl(originalUrl) {
  if (!originalUrl) return "";

  try {
    const url = new URL(originalUrl);

    if (!url.hostname.endsWith(".ucarecd.net")) {
      return "";
    }

    url.search = "";
    url.hash = "";

    let path = url.pathname.replace(/\/+$/, "");

    if (path.endsWith("/adaptive_video")) {
      return `${url.origin}${path}/`;
    }

    if (path.includes("/video/") || path.includes("/-/")) {
      return "";
    }

    return `${url.origin}${path}/adaptive_video/`;

  } catch (error) {
    console.warn("Invalid video URL:", error);
    return "";
  }
}

// ==========================================
// VIDEO DOWNLOAD
// ==========================================

async function downloadSelectedVideo() {
  if (!selectedAccount?.videoUrl) {
    alert("There is no video available for this account.");
    return;
  }

  const videoUrl = selectedAccount.videoUrl;

  const originalText = downloadVideoButton?.innerHTML;

  if (downloadVideoButton) {
    downloadVideoButton.disabled = true;
    downloadVideoButton.setAttribute("aria-busy", "true");
    downloadVideoButton.title = "Preparing video...";
  }

  try {
    // Try downloading as a file when the host allows it.
    const response = await fetch(videoUrl, {
      mode: "cors"
    });

    if (!response.ok) {
      throw new Error("Video download request failed.");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${(selectedAccount.title || "F5-STORE-VIDEO")
      .replace(/[^\w\-]+/g, "_")}.mp4`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

  } catch (error) {
    console.warn("Direct video download unavailable:", error);

    // Fallback: open the original video URL so the user can save it.
    const opened = window.open(
      videoUrl,
      "_blank",
      "noopener,noreferrer"
    );

    if (!opened) {
      window.location.href = videoUrl;
    }

    alert(
      "The direct download was not available. The video link has been opened so you can save it from your browser."
    );

  } finally {
    if (downloadVideoButton) {
      downloadVideoButton.disabled = false;
      downloadVideoButton.removeAttribute("aria-busy");
      downloadVideoButton.title = "Download video";

      if (originalText !== null) {
        downloadVideoButton.innerHTML = originalText;
      }
    }
  }
}

// ==========================================
// SHARE VIDEO
// ==========================================

async function shareSelectedVideo() {
  if (!selectedAccount?.videoUrl) {
    alert("There is no video available for this account.");
    return;
  }

  const videoUrl = selectedAccount.videoUrl;

  const shareData = {
    title: `${selectedAccount.title || "PUBG Account"} - F5 STORE`,
    text: "Watch this PUBG account video from F5 STORE.",
    url: videoUrl
  };

  if (typeof navigator.share === "function") {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("Video sharing unavailable:", error);
    }
  }

  try {
    const copied = await copyTextFallback(videoUrl);

    if (copied) {
      alert("Video link copied successfully!");
    }
  } catch (error) {
    console.error("Video sharing failed:", error);
    window.prompt("Copy video link:", videoUrl);
  }
}

// Connect video action buttons
downloadVideoButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  downloadSelectedVideo();
});

shareVideoButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  shareSelectedVideo();
});

// ==========================================
// VIDEO PREVIEW - LAZY LOADING
// ==========================================

function createAccountVideo(account) {
  const videoUrl = account.videoUrl || "";

  if (!videoUrl) {
    const placeholder = document.createElement("div");
    placeholder.className = "account-video-placeholder";
    placeholder.textContent = "VIDEO NOT AVAILABLE";
    return placeholder;
  }

  const video = document.createElement("video");

  video.className = "account-video-preview";
  video.preload = "none";
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.loop = true;
  video.controls = false;
  video.dataset.videoUrl = videoUrl;

  video.setAttribute("aria-label", "Account video preview");

  if ("IntersectionObserver" in window) {
    if (!previewObserver) {
      previewObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const item = entry.target;

          if (entry.isIntersecting) {
            if (!item.src && item.dataset.videoUrl) {
              item.src = item.dataset.videoUrl;
              item.load();
            }

            item.play().catch(() => {});
          } else {
            item.pause();
          }
        });
      }, {
        rootMargin: "80px",
        threshold: 0.05
      });
    }

    previewObserver.observe(video);

  } else {
    video.src = videoUrl;
    video.load();
  }

  video.addEventListener("error", () => {
    const placeholder = document.createElement("div");
    placeholder.className = "account-video-placeholder";
    placeholder.textContent = "VIDEO PREVIEW UNAVAILABLE";

    previewObserver?.unobserve(video);
    video.replaceWith(placeholder);
  });

  return video;
}

// ==========================================
// CREATE ACCOUNT CARD
// ==========================================

function createAccountCard(account) {
  const card = document.createElement("article");

  card.className = "account-card reveal";
  card.setAttribute("tabindex", "0");
  card.setAttribute("role", "button");

  card.setAttribute(
    "aria-label",
    `View details for ${account.title || "PUBG account"}`
  );

  const videoPreview = createAccountVideo(account);

  const info = document.createElement("div");
  info.className = "account-info";

  const title = document.createElement("h3");
  title.textContent = account.title || "PUBG Account";

  const description = document.createElement("div");
  description.className = "account-description-preview";
  description.textContent =
    account.description || "Click to view full account details.";

  const price = document.createElement("div");
  price.className = "account-price";
  price.textContent = formatAccountPrice(account.price);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "account-buy";
  button.textContent = "VIEW ACCOUNT DETAILS";

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    openAccountDetails(account);
  });

  card.addEventListener("click", () => {
    openAccountDetails(account);
  });

  card.addEventListener("keydown", (event) => {
    if (
      event.target === card &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      openAccountDetails(account);
    }
  });

  info.appendChild(title);
  info.appendChild(description);
  info.appendChild(price);
  info.appendChild(button);

  card.appendChild(videoPreview);
  card.appendChild(info);

  return card;
}

// ==========================================
// DISPLAY ACCOUNTS
// ==========================================

function displayAccounts(accounts) {
  if (!accountsGrid) return;

  if (previewObserver) {
    accountsGrid.querySelectorAll("video.account-video-preview").forEach((video) => {
      previewObserver.unobserve(video);
      video.pause();
      video.removeAttribute("src");
      video.load();
    });
  }

  accountsGrid.innerHTML = "";

  if (!accounts || accounts.length === 0) {
    showAccountsEmpty();
    return;
  }

  if (accountsEmpty) accountsEmpty.hidden = true;

  accounts.sort((a, b) => {
    const dateA = a.createdAt?.toMillis
      ? a.createdAt.toMillis()
      : 0;

    const dateB = b.createdAt?.toMillis
      ? b.createdAt.toMillis()
      : 0;

    return dateB - dateA;
  });

  accounts.forEach((account) => {
    accountsGrid.appendChild(createAccountCard(account));
  });

  observeRevealElements(accountsGrid);
}

// ==========================================
// OPEN SHARED ACCOUNT FROM URL
// ==========================================

function openSharedAccountFromUrl(accounts) {
  const sharedId =
    new URLSearchParams(window.location.search).get("account");

  if (!sharedId || sharedAccountOpened) return;

  const sharedAccount =
    accounts.find((account) => account.id === sharedId);

  if (!sharedAccount) return;

  sharedAccountOpened = true;
  openAccountDetails(sharedAccount);
}

// ==========================================
// LOAD ACCOUNTS FROM FIRESTORE
// ==========================================

function loadAccounts() {
  if (!accountsGrid || !firestoreModule || !db) return;

  showAccountsLoading();

  if (accountsUnsubscribe) {
    accountsUnsubscribe();
    accountsUnsubscribe = null;
  }

  try {
    const accountsReference =
      firestoreModule.collection(db, "accounts");

    const accountsQuery = firestoreModule.query(
      accountsReference,
      firestoreModule.where("status", "==", "available")
    );

    accountsUnsubscribe = firestoreModule.onSnapshot(
      accountsQuery,

      (snapshot) => {
        hideAccountsLoading();

        if (accountsError) accountsError.hidden = true;

        const accounts = [];

        snapshot.forEach((documentSnapshot) => {
          const data = documentSnapshot.data();

          accounts.push({
            id: documentSnapshot.id,
            title: data.title || "",
            description: data.description || "",
            price: data.price ?? "",
            videoUrl: data.videoUrl || "",
            status: data.status || "",
            createdAt: data.createdAt || null
          });
        });

        displayAccounts(accounts);
        openSharedAccountFromUrl(accounts);
      },

      (error) => {
        console.error("Firestore accounts listener error:", error);
        showAccountsError();
      }
    );

  } catch (error) {
    console.error("Accounts loading error:", error);
    showAccountsError();
  }
}

// ==========================================
// STOP DETAILS VIDEO
// ==========================================

function stopDetailsVideo() {
  if (!accountDetailsVideo) return;

  accountDetailsVideo.pause();

  if (detailsHls) {
    detailsHls.destroy();
    detailsHls = null;
  }

  accountDetailsVideo.removeAttribute("src");

  accountDetailsVideo.querySelectorAll("source").forEach((source) => {
    source.remove();
  });

  accountDetailsVideo.load();
}

// ==========================================
// PLAY ORIGINAL VIDEO AS FALLBACK
// ==========================================

function playOriginalVideo(originalUrl) {
  if (!accountDetailsVideo || !originalUrl) return;

  if (detailsHls) {
    detailsHls.destroy();
    detailsHls = null;
  }

  accountDetailsVideo.removeAttribute("src");
  accountDetailsVideo.load();

  accountDetailsVideo.src = originalUrl;
  accountDetailsVideo.load();

  accountDetailsVideo.play().catch(() => {});
}

// ==========================================
// OPEN ACCOUNT DETAILS - OPTIMIZED HLS
// ==========================================

function openAccountDetails(account) {
  if (!accountDetailsModal || !account) return;

  selectedAccount = account;

  const accountUrl = new URL(window.location.href);
  accountUrl.searchParams.set("account", account.id);

  window.history.replaceState({}, "", accountUrl);

  if (accountDetailsTitle) {
    accountDetailsTitle.textContent =
      account.title || "PUBG ACCOUNT";
  }

  if (accountDetailsDescription) {
    accountDetailsDescription.textContent =
      account.description || "No description available.";
  }

  if (accountDetailsPrice) {
    accountDetailsPrice.textContent =
      formatAccountPrice(account.price);
  }

  if (downloadVideoButton) {
    downloadVideoButton.disabled = !account.videoUrl;
  }

  if (shareVideoButton) {
    shareVideoButton.disabled = !account.videoUrl;
  }

  if (accountDetailsVideo) {
    stopDetailsVideo();

    if (account.videoUrl) {
      accountDetailsVideo.style.display = "block";
      accountDetailsVideo.controls = true;
      accountDetailsVideo.playsInline = true;

      // Avoid loading the entire video immediately.
      accountDetailsVideo.preload = "metadata";

      accountDetailsVideo.setAttribute("playsinline", "");
      accountDetailsVideo.setAttribute("webkit-playsinline", "");

      if (accountDetailsVideoPlaceholder) {
        accountDetailsVideoPlaceholder.style.display = "none";
      }

      const adaptiveUrl = getAdaptiveVideoUrl(account.videoUrl);
      const HlsPlayer = window.Hls;

      if (adaptiveUrl && HlsPlayer && HlsPlayer.isSupported()) {
        detailsHls = new HlsPlayer({
          enableWorker: true,
          capLevelToPlayerSize: true,
          startLevel: -1,

          // Keep the buffer moderate to reduce memory usage.
          maxBufferLength: 12,
          maxMaxBufferLength: 20,
          maxBufferSize: 30 * 1000 * 1000,
          backBufferLength: 20,

          // Avoid excessive loading ahead.
          maxBufferHole: 0.5,
          highBufferWatchdogPeriod: 2,

          // Allow recovery from temporary network issues.
          fragLoadingMaxRetry: 4,
          manifestLoadingMaxRetry: 3,
          levelLoadingMaxRetry: 3
        });

        detailsHls.loadSource(adaptiveUrl);
        detailsHls.attachMedia(accountDetailsVideo);

        detailsHls.on(
          HlsPlayer.Events.MANIFEST_PARSED,
          () => {
            accountDetailsVideo.play().catch(() => {});
          }
        );

        detailsHls.on(
          HlsPlayer.Events.ERROR,
          (event, data) => {
            if (!data.fatal) return;

            console.error("HLS playback error:", data);

            if (data.type === HlsPlayer.ErrorTypes.NETWORK_ERROR) {
              detailsHls?.startLoad();
              return;
            }

            if (data.type === HlsPlayer.ErrorTypes.MEDIA_ERROR) {
              detailsHls?.recoverMediaError();
              return;
            }

            playOriginalVideo(account.videoUrl);
          }
        );

      } else if (
        adaptiveUrl &&
        accountDetailsVideo.canPlayType("application/vnd.apple.mpegurl")
      ) {
        accountDetailsVideo.src = adaptiveUrl;
        accountDetailsVideo.load();

        accountDetailsVideo.play().catch(() => {});

      } else {
        playOriginalVideo(account.videoUrl);
      }

    } else {
      accountDetailsVideo.style.display = "none";

      if (accountDetailsVideoPlaceholder) {
        accountDetailsVideoPlaceholder.style.display = "flex";
      }
    }
  }

  accountDetailsModal.classList.add("open");
  accountDetailsModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

// ==========================================
// CLOSE ACCOUNT DETAILS
// ==========================================

function closeAccountDetails() {
  if (!accountDetailsModal) return;

  accountDetailsModal.classList.remove("open");
  accountDetailsModal.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");

  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("account");

  window.history.replaceState({}, "", cleanUrl);

  stopDetailsVideo();
  selectedAccount = null;
}

$("closeAccountDetails")?.addEventListener(
  "click",
  closeAccountDetails
);

$("closeAccountDetailsBottom")?.addEventListener(
  "click",
  closeAccountDetails
);

accountDetailsModal?.addEventListener("click", (event) => {
  if (event.target === accountDetailsModal) {
    closeAccountDetails();
  }
});

// ==========================================
// ACCOUNT WHATSAPP ORDER
// ==========================================

if (accountDetailsWhatsApp) {
  accountDetailsWhatsApp.addEventListener("click", () => {
    if (!selectedAccount) return;

    const message =
      `Hi F5 STORE!\n\n` +
      `I am interested in this PUBG Mobile account.\n\n` +
      `Account: ${selectedAccount.title || "PUBG Account"}\n` +
      `Account ID: ${selectedAccount.id}\n\n` +
      `Please send me more details.`;

    sendWhatsAppMessage(message);
  });
}

// ==========================================
// FEEDBACK IMAGE LIGHTBOX
// ==========================================

function openFeedbackLightbox(imageUrl, altText = "Customer feedback") {
  if (!feedbackLightbox || !feedbackLightboxImage || !imageUrl) {
    window.open(imageUrl, "_blank", "noopener,noreferrer");
    return;
  }

  feedbackLightboxImage.src = imageUrl;
  feedbackLightboxImage.alt = altText;

  feedbackLightbox.classList.add("open");
  feedbackLightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeFeedbackLightbox() {
  if (!feedbackLightbox) return;

  feedbackLightbox.classList.remove("open");
  feedbackLightbox.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");

  if (feedbackLightboxImage) {
    feedbackLightboxImage.removeAttribute("src");
  }
}

document.querySelectorAll("[data-feedback-image], .feedback-image").forEach((element) => {
  element.addEventListener("click", () => {
    const image =
      element.matches("img") ? element : element.querySelector("img");

    const imageUrl =
      element.dataset.full ||
      image?.dataset.full ||
      image?.src;

    const altText =
      image?.alt || "Customer feedback";

    if (imageUrl) {
      openFeedbackLightbox(imageUrl, altText);
    }
  });
});

closeFeedbackLightboxButton?.addEventListener(
  "click",
  closeFeedbackLightbox
);

feedbackLightbox?.addEventListener("click", (event) => {
  if (event.target === feedbackLightbox) {
    closeFeedbackLightbox();
  }
});

// ==========================================
// FIREBASE INITIALIZATION
// ==========================================

async function initFirebaseAuth() {
  try {
    setStatus("Connecting to Firebase...", "success");

    const [
      appModule,
      loadedAuthModule,
      loadedFirestoreModule
    ] = await Promise.all([
      import(`${FIREBASE_BASE}/firebase-app.js`),
      import(`${FIREBASE_BASE}/firebase-auth.js`),
      import(`${FIREBASE_BASE}/firebase-firestore.js`)
    ]);

    authModule = loadedAuthModule;
    firestoreModule = loadedFirestoreModule;

    const existingApps = appModule.getApps();

    firebaseApp = existingApps.length
      ? appModule.getApp()
      : appModule.initializeApp(firebaseConfig);

    auth = authModule.getAuth(firebaseApp);
    db = firestoreModule.getFirestore(firebaseApp);

    firebaseReady = true;

    loadAccounts();

    authModule.onAuthStateChanged(auth, (user) => {
      currentAdminUser = null;

      if (!user) {
        if ($("adminSession")) {
          $("adminSession").hidden = true;
        }
        return;
      }

      if (user.uid !== ADMIN_UID) {
        authModule.signOut(auth).catch(console.error);

        setStatus(
          "Access denied: this account is not the F5 STORE administrator."
        );

        if ($("adminSession")) {
          $("adminSession").hidden = true;
        }
        return;
      }

      currentAdminUser = user;

      if ($("adminSession")) {
        $("adminSession").hidden = false;
      }

      if ($("sessionText")) {
        $("sessionText").textContent =
          `Signed in as ${user.email || "F5 STORE admin"}`;
      }

      setStatus("Admin authentication successful.", "success");
    });

    setStatus("Firebase connected. You can sign in.", "success");

  } catch (error) {
    console.error("Firebase initialization error:", error);

    firebaseReady = false;

    setStatus(
      `Firebase initialization failed: ${error.code || ""} ${error.message || error}`
    );

    showAccountsError();
  }
}

// ==========================================
// FIREBASE SIGN IN
// ==========================================

if ($("loginForm")) {
  $("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!firebaseReady || !auth || !authModule) {
      setStatus(
        "Firebase is not ready. Refresh the page and try again."
      );
      return;
    }

    const email = $("adminEmail").value.trim();
    const password = $("adminPassword").value;

    if (!email || !password) {
      setStatus("Please enter your email and password.");
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "CONNECTING...";

    setStatus("Signing in securely...", "success");

    try {
      const credential =
        await authModule.signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      if (credential.user.uid !== ADMIN_UID) {
        await authModule.signOut(auth);

        setStatus(
          "Access denied: this account is not the store administrator."
        );
        return;
      }

      currentAdminUser = credential.user;

      setStatus(
        "Login successful. Opening admin dashboard...",
        "success"
      );

      window.location.href = ADMIN_PAGE_URL;

    } catch (error) {
      console.error("Firebase sign-in error:", error);

      const messages = {
        "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
          "Firebase rejected the API key. Check the current Web API Key in Firebase Project Settings and Google Cloud API key restrictions.",

        "auth/invalid-api-key":
          "The Firebase API key is invalid. Check your Firebase Web Config.",

        "auth/network-request-failed":
          "Network request failed. Check internet, VPN, ad blocker, and Firebase connectivity.",

        "auth/invalid-credential":
          "Email or password is incorrect.",

        "auth/invalid-email":
          "Please enter a valid email address.",

        "auth/user-disabled":
          "This administrator account has been disabled.",

        "auth/too-many-requests":
          "Too many attempts. Please wait before trying again.",

        "auth/unauthorized-domain":
          "This website domain is not authorized in Firebase.",

        "auth/operation-not-allowed":
          "Email/Password sign-in is not enabled in Firebase."
      };

      setStatus(
        messages[error.code] ||
        `Sign-in failed (${error.code || "unknown"}): ${error.message || "Please try again."}`
      );

    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "SIGN IN";
    }
  });
}

// ==========================================
// ADMIN SIGN OUT
// ==========================================

$("logoutButton")?.addEventListener("click", async () => {
  if (!auth || !authModule) return;

  try {
    await authModule.signOut(auth);
    currentAdminUser = null;

    setStatus("Signed out successfully.", "success");

    if ($("adminSession")) {
      $("adminSession").hidden = true;
    }

  } catch (error) {
    console.error("Sign-out error:", error);
    setStatus("Could not sign out: " + error.message);
  }
});

// ==========================================
// START FIREBASE
// ==========================================

initFirebaseAuth();

// ==========================================
// CLEANUP
// ==========================================

window.addEventListener("beforeunload", () => {
  if (accountsUnsubscribe) {
    accountsUnsubscribe();
    accountsUnsubscribe = null;
  }

  if (previewObserver) {
    previewObserver.disconnect();
    previewObserver = null;
  }

  if (revealObserver) {
    revealObserver.disconnect();
    revealObserver = null;
  }

  if (detailsHls) {
    detailsHls.destroy();
    detailsHls = null;
  }
});