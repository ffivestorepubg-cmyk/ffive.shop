
"use strict";

// ==========================================
// F5 STORE - MAIN JAVASCRIPT
// Firebase Authentication + Firestore
// Optimized video playback + Sharing
// ==========================================

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================

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

const STORE_URL = "https://ffive.store/";

const FIREBASE_VERSION = "10.12.2";

const FIREBASE_BASE =
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const $ = (id) => document.getElementById(id);

// ==========================================
// GLOBAL STATE
// ==========================================

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
let detailsPlaybackToken = 0;

let revealObserver = null;

let sharedAccountOpened = false;
let sharedAccountLookupFinished = false;

// ==========================================
// ELEMENTS
// ==========================================

const modal = $("adminModal");
const statusEl = $("loginStatus");
const loginButton = $("loginButton");

const accountsGrid = $("accountsGrid");
const accountsLoading = $("accountsLoading");
const accountsEmpty = $("accountsEmpty");
const accountsError = $("accountsError");

const accountDetailsModal = $("accountDetailsModal");
const accountDetailsVideo = $("accountDetailsVideo");

const accountDetailsVideoPlaceholder =
  $("accountDetailsVideoPlaceholder");

const accountDetailsTitle =
  $("accountDetailsTitle");

const accountDetailsDescription =
  $("accountDetailsDescription");

const accountDetailsPrice =
  $("accountDetailsPrice");

const accountDetailsWhatsApp =
  $("accountDetailsWhatsApp");

const accountDetailsShare =
  $("accountDetailsShare");

const downloadVideoButton =
  $("downloadAccountVideo");

const shareVideoButton =
  $("shareAccountVideo");

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

  const opened = window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );

  if (!opened) {
    window.location.href = url;
  }
}

function openWhatsApp(uc, price) {
  const message =
    `Hi F5 STORE!\n\n` +
    `I want to buy the PUBG Mobile ${uc} package.\n` +
    `Price: $${price}\n\n` +
    `My Player ID is: `;

  sendWhatsAppMessage(message);
}

// ==========================================
// UC PACKAGE BUTTONS
// ==========================================

document.querySelectorAll(".package-card").forEach(
  (card) => {
    card.addEventListener("click", () => {
      const uc = card.dataset.uc;
      const price = card.dataset.price;

      if (uc && price) {
        openWhatsApp(uc, price);
      }
    });

    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");

    card.addEventListener("keydown", (event) => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();

        const uc = card.dataset.uc;
        const price = card.dataset.price;

        if (uc && price) {
          openWhatsApp(uc, price);
        }
      }
    });
  }
);

// ==========================================
// FOOTER YEAR
// ==========================================

if ($("year")) {
  $("year").textContent =
    new Date().getFullYear();
}

// ==========================================
// MOBILE MENU
// ==========================================

if ($("menuToggle") && $("nav")) {
  $("menuToggle").addEventListener(
    "click",
    () => {
      const isOpen =
        $("nav").classList.toggle("open");

      $("menuToggle").setAttribute(
        "aria-expanded",
        String(isOpen)
      );
    }
  );
}

document.querySelectorAll(".nav a").forEach(
  (link) => {
    link.addEventListener("click", () => {
      $("nav")?.classList.remove("open");

      $("menuToggle")?.setAttribute(
        "aria-expanded",
        "false"
      );
    });
  }
);

// ==========================================
// SCROLL ANIMATIONS
// ==========================================

function observeRevealElements(
  container = document
) {
  if (!("IntersectionObserver" in window)) {
    container.querySelectorAll(".reveal").forEach(
      (element) => {
        element.classList.add("visible");
      }
    );
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(
              "visible"
            );

            revealObserver.unobserve(
              entry.target
            );
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: "50px"
      }
    );
  }

  container
    .querySelectorAll(".reveal:not(.visible)")
    .forEach((element) => {
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

  modal.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add(
    "modal-open"
  );
}

function hideModal() {
  if (!modal) return;

  modal.classList.remove("open");

  modal.setAttribute(
    "aria-hidden",
    "true"
  );

  if (!accountDetailsModal?.classList.contains("open")) {
    document.body.classList.remove(
      "modal-open"
    );
  }
}

$("openAdmin")?.addEventListener(
  "click",
  showModal
);

$("closeAdmin")?.addEventListener(
  "click",
  hideModal
);

modal?.addEventListener(
  "click",
  (event) => {
    if (event.target === modal) {
      hideModal();
    }
  }
);

// ==========================================
// ACCOUNT LOADING MESSAGES
// ==========================================

function showAccountsLoading() {
  if (accountsLoading) {
    accountsLoading.hidden = false;
    accountsLoading.style.display = "block";
  }

  if (accountsEmpty) {
    accountsEmpty.hidden = true;
  }

  if (accountsError) {
    accountsError.hidden = true;
  }
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
  }
}

function showAccountsError(
  message = "Unable to load accounts right now. Please refresh the page and try again."
) {
  hideAccountsLoading();

  if (accountsError) {
    accountsError.textContent = message;
    accountsError.hidden = false;
  }
}

// ==========================================
// PRICE FORMAT
// ==========================================

function formatAccountPrice(price) {
  if (
    price === undefined ||
    price === null ||
    price === ""
  ) {
    return "Contact us";
  }

  const numericPrice = Number(price);

  if (!Number.isFinite(numericPrice)) {
    return "Contact us";
  }

  return `$${numericPrice.toFixed(2)}`;
}

// ==========================================
// ACCOUNT SHARE URL
// ==========================================

function getAccountShareUrl(accountId) {
  const url = new URL(STORE_URL);

  url.searchParams.set(
    "account",
    accountId
  );

  url.hash = "";

  return url.toString();
}

// ==========================================
// COPY LINK FALLBACK
// ==========================================

async function copyTextFallback(text) {
  if (
    navigator.clipboard?.writeText &&
    window.isSecureContext
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn(
        "Clipboard API failed:",
        error
      );
    }
  }

  const textArea =
    document.createElement("textarea");

  textArea.value = text;
  textArea.setAttribute(
    "readonly",
    ""
  );

  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";

  document.body.appendChild(textArea);

  textArea.focus();
  textArea.select();

  textArea.setSelectionRange(
    0,
    text.length
  );

  let copied = false;

  try {
    copied = document.execCommand(
      "copy"
    );
  } catch (error) {
    console.warn(
      "Clipboard fallback failed:",
      error
    );
  }

  textArea.remove();

  if (copied) return true;

  window.prompt(
    "Copy this link:",
    text
  );

  return false;
}

// ==========================================
// SHARE ACCOUNT
// ==========================================

async function shareSelectedAccount() {
  if (!selectedAccount?.id) {
    alert(
      "Please open an account before sharing."
    );
    return;
  }

  const shareUrl =
    getAccountShareUrl(
      selectedAccount.id
    );

  const title =
    selectedAccount.title ||
    "PUBG Account";

  const shareData = {
    title: `${title} | F5 STORE`,
    text:
      `Check out this PUBG Mobile account: ${title}`,
    url: shareUrl
  };

  if (
    typeof navigator.share ===
    "function"
  ) {
    try {
      await navigator.share(
        shareData
      );
      return;

    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        return;
      }

      console.warn(
        "Native sharing failed:",
        error
      );
    }
  }

  try {
    const copied =
      await copyTextFallback(
        shareUrl
      );

    if (copied) {
      alert(
        "Account link copied successfully!"
      );
    }

  } catch (error) {
    console.error(
      "Account sharing failed:",
      error
    );

    window.prompt(
      "Copy this account link:",
      shareUrl
    );
  }
}

if (accountDetailsShare) {
  accountDetailsShare.type = "button";

  accountDetailsShare.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      shareSelectedAccount();
    }
  );
}

// ==========================================
// VIDEO URL HELPERS
// ==========================================

function getAdaptiveVideoUrl(originalUrl) {
  if (!originalUrl) return "";

  try {
    const url =
      new URL(originalUrl);

    if (
      url.hostname !== "ucarecdn.com" &&
      !url.hostname.endsWith(
        ".ucarecdn.com"
      )
    ) {
      return "";
    }

    url.search = "";
    url.hash = "";

    const path =
      url.pathname.replace(
        /\/+$/,
        ""
      );

    if (
      path.endsWith(
        "/adaptive_video"
      )
    ) {
      return (
        `${url.origin}${path}/`
      );
    }

    // Do not append an adaptive-video
    // operation to an already transformed URL.
    if (
      path.includes("/-/") ||
      path.includes("/video/")
    ) {
      return "";
    }

    return (
      `${url.origin}${path}/adaptive_video/`
    );

  } catch (error) {
    console.warn(
      "Invalid video URL:",
      error
    );

    return "";
  }
}

// ==========================================
// VIDEO THUMBNAIL HELPERS
// ==========================================

function getVideoPosterUrl(account) {
  if (account.thumbnailUrl) {
    return account.thumbnailUrl;
  }

  const videoUrl =
    account.videoUrl || "";

  if (!videoUrl) return "";

  try {
    const url = new URL(videoUrl);

    if (
      url.hostname !== "ucarecdn.com" &&
      !url.hostname.endsWith(
        ".ucarecdn.com"
      )
    ) {
      return "";
    }

    const match =
      url.pathname.match(
        /^\/([0-9a-f-]{36})\/?$/i
      );

    if (!match) return "";

    // Uploadcare video thumbnail operation.
    return (
      `https://ucarecdn.com/${match[1]}/video/-/thumbs~1/1/`
    );

  } catch {
    return "";
  }
}

// ==========================================
// VIDEO DOWNLOAD
// ==========================================

async function downloadSelectedVideo() {
  if (!selectedAccount?.videoUrl) {
    alert(
      "There is no video available for this account."
    );
    return;
  }

  const videoUrl =
    selectedAccount.videoUrl;

  if (downloadVideoButton) {
    downloadVideoButton.disabled = true;

    downloadVideoButton.setAttribute(
      "aria-busy",
      "true"
    );

    downloadVideoButton.title =
      "Preparing video...";
  }

  try {
    const response = await fetch(
      videoUrl,
      {
        mode: "cors"
      }
    );

    if (!response.ok) {
      throw new Error(
        "Video download request failed."
      );
    }

    const blob =
      await response.blob();

    const objectUrl =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = objectUrl;

    link.download =
      `${(
        selectedAccount.title ||
        "F5-STORE-VIDEO"
      ).replace(/[^\w-]+/g, "_")}.mp4`;

    document.body.appendChild(link);

    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(
        objectUrl
      );
    }, 60000);

  } catch (error) {
    console.warn(
      "Direct download unavailable:",
      error
    );

    const opened = window.open(
      videoUrl,
      "_blank",
      "noopener,noreferrer"
    );

    if (!opened) {
      window.location.href =
        videoUrl;
    }

  } finally {
    if (downloadVideoButton) {
      downloadVideoButton.disabled = false;

      downloadVideoButton.removeAttribute(
        "aria-busy"
      );

      downloadVideoButton.title =
        "Download video";
    }
  }
}

// ==========================================
// SHARE VIDEO
// ==========================================

async function shareSelectedVideo() {
  if (!selectedAccount?.videoUrl) {
    alert(
      "There is no video available for this account."
    );
    return;
  }

  const videoUrl =
    selectedAccount.videoUrl;

  const title =
    selectedAccount.title ||
    "PUBG Account";

  const shareData = {
    title: `${title} | F5 STORE`,
    text:
      "Watch this PUBG account video from F5 STORE.",
    url: videoUrl
  };

  if (
    typeof navigator.share ===
    "function"
  ) {
    try {
      await navigator.share(
        shareData
      );
      return;

    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        return;
      }

      console.warn(
        "Video sharing failed:",
        error
      );
    }
  }

  try {
    const copied =
      await copyTextFallback(
        videoUrl
      );

    if (copied) {
      alert(
        "Video link copied successfully!"
      );
    }

  } catch (error) {
    console.error(
      "Could not share video:",
      error
    );

    window.prompt(
      "Copy video link:",
      videoUrl
    );
  }
}

// ==========================================
// VIDEO ACTION BUTTONS
// ==========================================

downloadVideoButton?.addEventListener(
  "click",
  (event) => {
    event.preventDefault();
    event.stopPropagation();

    downloadSelectedVideo();
  }
);

shareVideoButton?.addEventListener(
  "click",
  (event) => {
    event.preventDefault();
    event.stopPropagation();

    shareSelectedVideo();
  }
);

// ==========================================
// CREATE ACCOUNT PREVIEW
// ==========================================

function createAccountPreview(account) {
  const wrapper =
    document.createElement("div");

  wrapper.className =
    "account-media";

  wrapper.style.position =
    "relative";

  wrapper.style.overflow =
    "hidden";

  wrapper.style.background =
    "linear-gradient(135deg,#1b293a,#0c121d)";

  const posterUrl =
    getVideoPosterUrl(account);

  if (posterUrl) {
    const image =
      document.createElement("img");

    image.className =
      "account-video-preview account-poster";

    image.src = posterUrl;
    image.alt =
      `${account.title || "PUBG account"} preview`;

    image.loading = "lazy";
    image.decoding = "async";

    image.style.objectFit =
      "cover";

    image.addEventListener(
      "error",
      () => {
        image.remove();

        if (!wrapper.querySelector(
          ".account-video-placeholder"
        )) {
          addPreviewPlaceholder(
            wrapper
          );
        }
      }
    );

    wrapper.appendChild(image);

  } else {
    addPreviewPlaceholder(
      wrapper
    );
  }

  if (account.videoUrl) {
    const playIcon =
      document.createElement("span");

    playIcon.textContent = "▶";

    playIcon.setAttribute(
      "aria-hidden",
      "true"
    );

    playIcon.style.position =
      "absolute";

    playIcon.style.top = "50%";
    playIcon.style.left = "50%";

    playIcon.style.transform =
      "translate(-50%,-50%)";

    playIcon.style.display =
      "grid";

    playIcon.style.placeItems =
      "center";

    playIcon.style.width =
      "54px";

    playIcon.style.height =
      "54px";

    playIcon.style.borderRadius =
      "50%";

    playIcon.style.background =
      "rgba(0,0,0,.65)";

    playIcon.style.border =
      "1px solid rgba(255,255,255,.35)";

    playIcon.style.color =
      "#fff";

    playIcon.style.fontSize =
      "21px";

    playIcon.style.pointerEvents =
      "none";

    wrapper.appendChild(
      playIcon
    );
  }

  return wrapper;
}

function addPreviewPlaceholder(wrapper) {
  const placeholder =
    document.createElement("div");

  placeholder.className =
    "account-video-placeholder";

  placeholder.textContent =
    "PUBG ACCOUNT";

  wrapper.appendChild(
    placeholder
  );
}

// ==========================================
// CREATE ACCOUNT CARD
// ==========================================

function createAccountCard(account) {
  const card =
    document.createElement("article");

  card.className =
    "account-card reveal";

  card.setAttribute(
    "tabindex",
    "0"
  );

  card.setAttribute(
    "role",
    "button"
  );

  card.setAttribute(
    "aria-label",
    `View details for ${
      account.title ||
      "PUBG account"
    }`
  );

  const media =
    createAccountPreview(
      account
    );

  const info =
    document.createElement("div");

  info.className =
    "account-info";

  const title =
    document.createElement("h3");

  title.textContent =
    account.title ||
    "PUBG Account";

  const description =
    document.createElement("div");

  description.className =
    "account-description-preview";

  description.textContent =
    account.description ||
    "Click to view full account details.";

  const price =
    document.createElement("div");

  price.className =
    "account-price";

  price.textContent =
    formatAccountPrice(
      account.price
    );

  const button =
    document.createElement("button");

  button.type = "button";

  button.className =
    "account-buy";

  button.textContent =
    "VIEW ACCOUNT DETAILS";

  button.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();

      openAccountDetails(
        account
      );
    }
  );

  card.addEventListener(
    "click",
    () => {
      openAccountDetails(
        account
      );
    }
  );

  card.addEventListener(
    "keydown",
    (event) => {
      if (
        event.target === card &&
        (
          event.key === "Enter" ||
          event.key === " "
        )
      ) {
        event.preventDefault();

        openAccountDetails(
          account
        );
      }
    }
  );

  info.appendChild(title);
  info.appendChild(description);
  info.appendChild(price);
  info.appendChild(button);

  card.appendChild(media);
  card.appendChild(info);

  return card;
}

// ==========================================
// DISPLAY ACCOUNTS
// ==========================================

function displayAccounts(accounts) {
  if (!accountsGrid) return;

  accountsGrid.replaceChildren();

  if (
    !accounts ||
    accounts.length === 0
  ) {
    showAccountsEmpty();
    return;
  }

  if (accountsEmpty) {
    accountsEmpty.hidden = true;
  }

  accounts.sort((a, b) => {
    const dateA =
      a.createdAt?.toMillis
        ? a.createdAt.toMillis()
        : 0;

    const dateB =
      b.createdAt?.toMillis
        ? b.createdAt.toMillis()
        : 0;

    return dateB - dateA;
  });

  const fragment =
    document.createDocumentFragment();

  accounts.forEach((account) => {
    fragment.appendChild(
      createAccountCard(
        account
      )
    );
  });

  accountsGrid.appendChild(
    fragment
  );

  observeRevealElements(
    accountsGrid
  );
}

// ==========================================
// SHARED ACCOUNT FROM URL
// ==========================================

function getSharedAccountId() {
  return new URLSearchParams(
    window.location.search
  ).get("account");
}

function openSharedAccountFromUrl(accounts) {
  const sharedId =
    getSharedAccountId();

  if (
    !sharedId ||
    sharedAccountOpened
  ) {
    return;
  }

  const sharedAccount =
    accounts.find(
      (account) =>
        account.id === sharedId
    );

  if (sharedAccount) {
    sharedAccountOpened = true;

    openAccountDetails(
      sharedAccount
    );

    return;
  }

  if (!sharedAccountLookupFinished) {
    sharedAccountLookupFinished = true;

    console.warn(
      "Shared account not found:",
      sharedId
    );

    if (accountsError) {
      accountsError.textContent =
        "The shared account is unavailable or has been sold.";

      accountsError.hidden =
        false;
    }
  }
}

// ==========================================
// LOAD ACCOUNTS FROM FIRESTORE
// ==========================================

function loadAccounts() {
  if (
    !accountsGrid ||
    !firestoreModule ||
    !db
  ) {
    return;
  }

  showAccountsLoading();

  if (accountsUnsubscribe) {
    accountsUnsubscribe();
    accountsUnsubscribe = null;
  }

  try {
    const accountsReference =
      firestoreModule.collection(
        db,
        "accounts"
      );

    const accountsQuery =
      firestoreModule.query(
        accountsReference,
        firestoreModule.where(
          "status",
          "==",
          "available"
        )
      );

    accountsUnsubscribe =
      firestoreModule.onSnapshot(
        accountsQuery,

        (snapshot) => {
          hideAccountsLoading();

          if (accountsError) {
            accountsError.hidden =
              true;
          }

          const accounts = [];

          snapshot.forEach(
            (documentSnapshot) => {
              const data =
                documentSnapshot.data();

              accounts.push({
                id:
                  documentSnapshot.id,

                title:
                  data.title || "",

                description:
                  data.description || "",

                price:
                  data.price ?? "",

                videoUrl:
                  data.videoUrl || "",

                thumbnailUrl:
                  data.thumbnailUrl || "",

                status:
                  data.status || "",

                createdAt:
                  data.createdAt || null
              });
            }
          );

          displayAccounts(
            accounts
          );

          openSharedAccountFromUrl(
            accounts
          );
        },

        (error) => {
          console.error(
            "Firestore listener error:",
            error
          );

          showAccountsError();
        }
      );

  } catch (error) {
    console.error(
      "Accounts loading error:",
      error
    );

    showAccountsError();
  }
}

// ==========================================
// STOP DETAILS VIDEO
// ==========================================

function stopDetailsVideo() {
  detailsPlaybackToken++;

  if (!accountDetailsVideo) {
    return;
  }

  accountDetailsVideo.pause();

  if (detailsHls) {
    detailsHls.destroy();
    detailsHls = null;
  }

  accountDetailsVideo.removeAttribute(
    "src"
  );

  accountDetailsVideo
    .querySelectorAll("source")
    .forEach((source) => {
      source.remove();
    });

  accountDetailsVideo.load();
}

// ==========================================
// ORIGINAL VIDEO FALLBACK
// ==========================================

function playOriginalVideo(originalUrl) {
  if (
    !accountDetailsVideo ||
    !originalUrl
  ) {
    return;
  }

  if (detailsHls) {
    detailsHls.destroy();
    detailsHls = null;
  }

  accountDetailsVideo.pause();

  accountDetailsVideo.removeAttribute(
    "src"
  );

  accountDetailsVideo.src =
    originalUrl;

  accountDetailsVideo.load();
}

// ==========================================
// VIDEO PLAYBACK
// ==========================================

function prepareAccountVideo(account) {
  if (!accountDetailsVideo) return;

  stopDetailsVideo();

  const videoUrl =
    account.videoUrl || "";

  if (!videoUrl) {
    accountDetailsVideo.style.display =
      "none";

    if (
      accountDetailsVideoPlaceholder
    ) {
      accountDetailsVideoPlaceholder.style.display =
        "flex";
    }

    return;
  }

  accountDetailsVideo.style.display =
    "block";

  accountDetailsVideo.controls = true;
  accountDetailsVideo.playsInline = true;

  accountDetailsVideo.preload =
    "metadata";

  const poster =
    getVideoPosterUrl(
      account
    );

  if (poster) {
    accountDetailsVideo.poster =
      poster;
  } else {
    accountDetailsVideo.removeAttribute(
      "poster"
    );
  }

  if (
    accountDetailsVideoPlaceholder
  ) {
    accountDetailsVideoPlaceholder.style.display =
      "none";
  }

  const adaptiveUrl =
    getAdaptiveVideoUrl(
      videoUrl
    );

  const HlsPlayer =
    window.Hls;

  if (
    adaptiveUrl &&
    HlsPlayer &&
    HlsPlayer.isSupported()
  ) {
    const hls =
      new HlsPlayer({
        enableWorker: true,

        capLevelToPlayerSize: true,

        startLevel: -1,

        maxBufferLength: 10,

        maxMaxBufferLength: 20,

        maxBufferSize:
          25 * 1000 * 1000,

        backBufferLength: 10
      });

    detailsHls = hls;

    hls.loadSource(
      adaptiveUrl
    );

    hls.attachMedia(
      accountDetailsVideo
    );

    let recoveryAttempts = 0;

    hls.on(
      HlsPlayer.Events.ERROR,
      (event, data) => {
        if (
          !data.fatal ||
          detailsHls !== hls
        ) {
          return;
        }

        console.error(
          "HLS playback error:",
          data
        );

        recoveryAttempts++;

        if (
          recoveryAttempts > 2
        ) {
          playOriginalVideo(
            videoUrl
          );

          return;
        }

        if (
          data.type ===
          HlsPlayer.ErrorTypes.NETWORK_ERROR
        ) {
          hls.startLoad();
          return;
        }

        if (
          data.type ===
          HlsPlayer.ErrorTypes.MEDIA_ERROR
        ) {
          hls.recoverMediaError();
          return;
        }

        playOriginalVideo(
          videoUrl
        );
      }
    );

  } else if (
    adaptiveUrl &&
    accountDetailsVideo.canPlayType(
      "application/vnd.apple.mpegurl"
    )
  ) {
    accountDetailsVideo.src =
      adaptiveUrl;

    accountDetailsVideo.load();

  } else {
    playOriginalVideo(
      videoUrl
    );
  }
}

// ==========================================
// OPEN ACCOUNT DETAILS
// ==========================================

function openAccountDetails(account) {
  if (
    !accountDetailsModal ||
    !account
  ) {
    return;
  }

  selectedAccount = account;

  const accountUrl =
    new URL(
      window.location.href
    );

  accountUrl.searchParams.set(
    "account",
    account.id
  );

  window.history.replaceState(
    {},
    "",
    accountUrl
  );

  if (accountDetailsTitle) {
    accountDetailsTitle.textContent =
      account.title ||
      "PUBG ACCOUNT";
  }

  if (accountDetailsDescription) {
    accountDetailsDescription.textContent =
      account.description ||
      "No description available.";
  }

  if (accountDetailsPrice) {
    accountDetailsPrice.textContent =
      formatAccountPrice(
        account.price
      );
  }

  if (downloadVideoButton) {
    downloadVideoButton.disabled =
      !account.videoUrl;
  }

  if (shareVideoButton) {
    shareVideoButton.disabled =
      !account.videoUrl;
  }

  prepareAccountVideo(
    account
  );

  accountDetailsModal.classList.add(
    "open"
  );

  accountDetailsModal.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add(
    "modal-open"
  );
}

// ==========================================
// CLOSE ACCOUNT DETAILS
// ==========================================

function closeAccountDetails() {
  if (!accountDetailsModal) return;

  accountDetailsModal.classList.remove(
    "open"
  );

  accountDetailsModal.setAttribute(
    "aria-hidden",
    "true"
  );

  if (
    !modal?.classList.contains("open")
  ) {
    document.body.classList.remove(
      "modal-open"
    );
  }

  const cleanUrl =
    new URL(
      window.location.href
    );

  cleanUrl.searchParams.delete(
    "account"
  );

  window.history.replaceState(
    {},
    "",
    cleanUrl
  );

  stopDetailsVideo();

  selectedAccount = null;

  sharedAccountOpened = false;
}

// ==========================================
// CLOSE DETAILS BUTTONS
// ==========================================

$("closeAccountDetails")?.addEventListener(
  "click",
  closeAccountDetails
);

$("closeAccountDetailsBottom")?.addEventListener(
  "click",
  closeAccountDetails
);

accountDetailsModal?.addEventListener(
  "click",
  (event) => {
    if (
      event.target ===
      accountDetailsModal
    ) {
      closeAccountDetails();
    }
  }
);

// ==========================================
// ESCAPE KEY
// ==========================================

document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key !== "Escape"
    ) {
      return;
    }

    if (
      accountDetailsModal?.classList.contains(
        "open"
      )
    ) {
      closeAccountDetails();
      return;
    }

    if (
      modal?.classList.contains(
        "open"
      )
    ) {
      hideModal();
    }
  }
);

// ==========================================
// ACCOUNT WHATSAPP ORDER
// ==========================================

accountDetailsWhatsApp?.addEventListener(
  "click",
  () => {
    if (!selectedAccount) return;

    const accountLink =
      getAccountShareUrl(
        selectedAccount.id
      );

    const message =
      `Hi F5 STORE!\n\n` +
      `I am interested in this PUBG Mobile account.\n\n` +
      `Account: ${
        selectedAccount.title ||
        "PUBG Account"
      }\n` +
      `Price: ${
        formatAccountPrice(
          selectedAccount.price
        )
      }\n` +
      `Account ID: ${
        selectedAccount.id
      }\n` +
      `Link: ${accountLink}\n\n` +
      `Please send me more details.`;

    sendWhatsAppMessage(
      message
    );
  }
);

// ==========================================
// FIREBASE INITIALIZATION
// ==========================================

async function initFirebaseAuth() {
  try {
    setStatus(
      "Connecting to Firebase...",
      "success"
    );

    const [
      appModule,
      loadedAuthModule,
      loadedFirestoreModule
    ] = await Promise.all([
      import(
        `${FIREBASE_BASE}/firebase-app.js`
      ),

      import(
        `${FIREBASE_BASE}/firebase-auth.js`
      ),

      import(
        `${FIREBASE_BASE}/firebase-firestore.js`
      )
    ]);

    authModule =
      loadedAuthModule;

    firestoreModule =
      loadedFirestoreModule;

    const existingApps =
      appModule.getApps();

    firebaseApp =
      existingApps.length
        ? appModule.getApp()
        : appModule.initializeApp(
            firebaseConfig
          );

    auth =
      authModule.getAuth(
        firebaseApp
      );

    db =
      firestoreModule.getFirestore(
        firebaseApp
      );

    firebaseReady = true;

    loadAccounts();

    authModule.onAuthStateChanged(
      auth,
      (user) => {
        currentAdminUser = null;

        if (!user) {
          if ($("adminSession")) {
            $("adminSession").hidden =
              true;
          }

          return;
        }

        if (
          user.uid !==
          ADMIN_UID
        ) {
          authModule
            .signOut(auth)
            .catch(console.error);

          setStatus(
            "Access denied: this account is not the F5 STORE administrator."
          );

          if ($("adminSession")) {
            $("adminSession").hidden =
              true;
          }

          return;
        }

        currentAdminUser =
          user;

        if ($("adminSession")) {
          $("adminSession").hidden =
            false;
        }

        if ($("sessionText")) {
          $("sessionText").textContent =
            `Signed in as ${
              user.email ||
              "F5 STORE admin"
            }`;
        }

        setStatus(
          "Admin authentication successful.",
          "success"
        );
      }
    );

    setStatus(
      "Firebase connected. You can sign in.",
      "success"
    );

  } catch (error) {
    console.error(
      "Firebase initialization error:",
      error
    );

    firebaseReady = false;

    setStatus(
      `Firebase initialization failed: ${
        error.code || ""
      } ${
        error.message || error
      }`
    );

    showAccountsError();
  }
}

// ==========================================
// FIREBASE SIGN IN
// ==========================================

if ($("loginForm")) {
  $("loginForm").addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      if (
        !firebaseReady ||
        !auth ||
        !authModule
      ) {
        setStatus(
          "Firebase is not ready. Refresh the page and try again."
        );
        return;
      }

      const email =
        $("adminEmail").value.trim();

      const password =
        $("adminPassword").value;

      if (
        !email ||
        !password
      ) {
        setStatus(
          "Please enter your email and password."
        );
        return;
      }

      loginButton.disabled = true;

      loginButton.textContent =
        "CONNECTING...";

      setStatus(
        "Signing in securely...",
        "success"
      );

      try {
        const credential =
          await authModule.signInWithEmailAndPassword(
            auth,
            email,
            password
          );

        if (
          credential.user.uid !==
          ADMIN_UID
        ) {
          await authModule.signOut(
            auth
          );

          setStatus(
            "Access denied: this account is not the store administrator."
          );

          return;
        }

        currentAdminUser =
          credential.user;

        setStatus(
          "Login successful. Opening admin dashboard...",
          "success"
        );

        window.location.href =
          ADMIN_PAGE_URL;

      } catch (error) {
        console.error(
          "Firebase sign-in error:",
          error
        );

        const messages = {
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

          "auth/network-request-failed":
            "Network request failed. Check your internet connection.",

          "auth/operation-not-allowed":
            "Email/Password sign-in is not enabled in Firebase."
        };

        setStatus(
          messages[error.code] ||
          `Sign-in failed (${
            error.code || "unknown"
          }): ${
            error.message ||
            "Please try again."
          }`
        );

      } finally {
        loginButton.disabled =
          false;

        loginButton.textContent =
          "SIGN IN";
      }
    }
  );
}

// ==========================================
// ADMIN SIGN OUT
// ==========================================

$("logoutButton")?.addEventListener(
  "click",
  async () => {
    if (
      !auth ||
      !authModule
    ) {
      return;
    }

    try {
      await authModule.signOut(
        auth
      );

      currentAdminUser =
        null;

      setStatus(
        "Signed out successfully.",
        "success"
      );

      if ($("adminSession")) {
        $("adminSession").hidden =
          true;
      }

    } catch (error) {
      console.error(
        "Sign-out error:",
        error
      );

      setStatus(
        "Could not sign out: " +
        error.message
      );
    }
  }
);

// ==========================================
// START FIREBASE
// ==========================================

initFirebaseAuth();

// ==========================================
// CLEANUP
// ==========================================

window.addEventListener(
  "beforeunload",
  () => {
    if (accountsUnsubscribe) {
      accountsUnsubscribe();
      accountsUnsubscribe = null;
    }

    if (revealObserver) {
      revealObserver.disconnect();
      revealObserver = null;
    }

    if (detailsHls) {
      detailsHls.destroy();
      detailsHls = null;
    }
  }
);
