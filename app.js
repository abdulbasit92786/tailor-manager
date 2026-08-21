import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let db;

try {
  db = getFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch {
  db = getFirestore(app);
}

let currentUser = null;
let customers = [];
let orders = [];
let profile = {};
let activeOrderFilter = "all";

const $ = (id) => document.getElementById(id);
const qsa = (s) => [...document.querySelectorAll(s)];

function toast(message, type = "info") {
  const el = $("toast");
  if (!el) return;

  el.textContent = message;
  el.className = `toast show ${type}`;

  setTimeout(() => {
    el.className = "toast";
  }, 2800);
}

function setSyncStatus() {
  const online = navigator.onLine;
  const el = $("syncStatus");

  if (!el) return;

  el.textContent = online ? "Online / Sync" : "Offline";
  el.className = `sync-badge ${online ? "online" : "offline"}`;
}

window.addEventListener("online", () => {
  setSyncStatus();
  toast("Internet واپس آ گیا؛ Cloud Sync جاری رہے گا۔", "success");
});

window.addEventListener("offline", () => {
  setSyncStatus();
  toast("Offline mode: local data دستیاب ہے۔", "info");
});

function userRoot() {
  return doc(db, "users", currentUser.uid);
}

function customersCol() {
  return collection(userRoot(), "customers");
}

function ordersCol() {
  return collection(userRoot(), "orders");
}

function nowIso() {
  return new Date().toISOString();
}

function uidShort() {
  return (
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36)
  );
}

function customerNumber() {
  const nums = customers
    .map(c => Number(c.customerNo))
    .filter(Number.isFinite);

  const next = (nums.length ? Math.max(...nums) : 0) + 1;

  return String(next).padStart(3, "0");
}

function getMeasurements(prefix = "") {
  return {
    length: $(`${prefix}Length`).value.trim(),
    tera: $(`${prefix}Tera`).value.trim(),
    sleeve: $(`${prefix}Sleeve`).value.trim(),
    neck: $(`${prefix}Neck`).value.trim(),
    chest: $(`${prefix}Chest`).value.trim(),
    waist: $(`${prefix}Waist`).value.trim(),
    daman: $(`${prefix}Daman`).value.trim(),
    shalwarLength: $(`${prefix}ShalwarLength`).value.trim(),
    panja: $(`${prefix}Panja`).value.trim()
  };
}

function setMeasurements(m = {}, prefix = "") {
  $(`${prefix}Length`).value = m.length || "";
  $(`${prefix}Tera`).value = m.tera || "";
  $(`${prefix}Sleeve`).value = m.sleeve || "";
  $(`${prefix}Neck`).value = m.neck || "";
  $(`${prefix}Chest`).value = m.chest || "";
  $(`${prefix}Waist`).value = m.waist || "";
  $(`${prefix}Daman`).value = m.daman || "";
  $(`${prefix}ShalwarLength`).value = m.shalwarLength || "";
  $(`${prefix}Panja`).value = m.panja || "";
}

function getCustomerDesign() {
  return {
    daman:
      document.querySelector('input[name="daman"]:checked')?.value || "",

    pocketDouble: $("pocketDouble").checked,
    pocketFront: $("pocketFront").checked,
    pocketSide: $("pocketSide").checked,
    shalwarPocket: $("shalwarPocket").checked,
    tilaGoot: $("tilaGoot").checked,
    fitCuff: $("fitCuff").checked,
    simpleSleeve: $("simpleSleeve").checked,
    cuffSleeve: $("cuffSleeve").checked,
    tops: $("tops").checked,
    band: $("band").checked
  };
}

function setCustomerDesign(d = {}) {
  const radio = document.querySelector(
    `input[name="daman"][value="${CSS.escape(d.daman || "")}"]`
  );

  if (radio) radio.checked = true;

  $("pocketDouble").checked = !!d.pocketDouble;
  $("pocketFront").checked = !!d.pocketFront;
  $("pocketSide").checked = !!d.pocketSide;
  $("shalwarPocket").checked = !!d.shalwarPocket;
  $("tilaGoot").checked = !!d.tilaGoot;
  $("fitCuff").checked = !!d.fitCuff;
  $("simpleSleeve").checked = !!d.simpleSleeve;
  $("cuffSleeve").checked = !!d.cuffSleeve;
  $("tops").checked = !!d.tops;
  $("band").checked = !!d.band;
}

function getOrderDesign() {
  return {
    daman:
      document.querySelector('input[name="orderDaman"]:checked')?.value || "",

    pocketDouble: $("oPocketDouble").checked,
    pocketFront: $("oPocketFront").checked,
    pocketSide: $("oPocketSide").checked,
    shalwarPocket: $("oShalwarPocket").checked
  };
}

function setOrderDesign(d = {}) {
  const radio = document.querySelector(
    `input[name="orderDaman"][value="${CSS.escape(d.daman || "")}"]`
  );

  if (radio) radio.checked = true;

  $("oPocketDouble").checked = !!d.pocketDouble;
  $("oPocketFront").checked = !!d.pocketFront;
  $("oPocketSide").checked = !!d.pocketSide;
  $("oShalwarPocket").checked = !!d.shalwarPocket;
}

function money(n) {
  return `Rs ${Number(n || 0).toLocaleString("en-PK")}`;
}

function dateText(v) {
  if (!v) return "-";

  const d = new Date(v);

  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("en-PK");
}

async function loadData() {
  const [profileSnap, customerSnap, orderSnap] = await Promise.all([
    getDoc(userRoot()),
    getDocs(customersCol()),
    getDocs(ordersCol())
  ]);

  profile = profileSnap.exists()
    ? profileSnap.data()
    : {};

  customers = customerSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  orders = orderSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  customers.sort((a, b) =>
    String(a.name || "").localeCompare(
      String(b.name || ""),
      "ur"
    )
  );

  orders.sort((a, b) =>
    String(b.createdAtIso || "").localeCompare(
      String(a.createdAtIso || "")
    )
  );

  if (!profile.tailorName) {
    profile = {
      tailorName: currentUser.displayName
        ? `${currentUser.displayName} Tailors`
        : "My Tailors",

      phone: currentUser.phoneNumber || "",
      area: "",
      email: currentUser.email || ""
    };

    await setDoc(
      userRoot(),
      {
        ...profile,
        updatedAt: serverTimestamp()
      },
      {
        merge: true
      }
    );
  }

  $("tailorNameLabel").textContent =
    profile.tailorName || "Tailor";

  $("welcomeName").textContent =
    profile.tailorName || "Tailor";

  $("settingsTailorName").value =
    profile.tailorName || "";

  $("settingsPhone").value =
    profile.phone || "";

  $("settingsArea").value =
    profile.area || "";

  $("userAvatar").textContent =
    (profile.tailorName || "T")
      .trim()
      .charAt(0)
      .toUpperCase();

  renderCustomers();
  renderOrders();
  updateStats();
}

function showView(view) {
  qsa(".view").forEach(v => {
    v.classList.add("hidden");
  });

  const target = $(`${view}View`);

  if (target) {
    target.classList.remove("hidden");
  }

  $("menuPanel").classList.add("hidden");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function updateStats() {
  const pending =
    orders.filter(o => o.status === "pending");

  const unpaid =
    orders.filter(o => o.status === "unpaid");

  const paid =
    orders.filter(o => o.status === "paid");

  const remaining =
    orders.reduce(
      (sum, o) =>
        sum + Number(o.remaining || 0),
      0
    );

  $("pendingCount").textContent =
    pending.length;

  $("unpaidCount").textContent =
    unpaid.length;

  $("paidCount").textContent =
    paid.length;

  $("remainingAmount").textContent =
    money(remaining);
}

function renderCustomers() {
  const term =
    ($("customerSearch")?.value || "")
      .trim()
      .toLowerCase();

  const list = $("customerList");

  const filtered = customers.filter(c =>
    String(c.name || "")
      .toLowerCase()
      .includes(term) ||

    String(c.phone || "")
      .toLowerCase()
      .includes(term) ||

    String(c.customerNo || "")
      .includes(term)
  );

  if (!filtered.length) {
    list.innerHTML =
      `<div class="empty">کوئی کسٹمر نہیں ملا۔</div>`;
    return;
  }

  list.innerHTML = filtered.map(c => `
    <button
      class="list-card"
      data-customer-id="${c.id}"
    >
      <div class="avatar">
        ${escapeHtml(
          (c.name || "?").charAt(0)
        )}
      </div>

      <div class="list-main">
        <strong>
          ${escapeHtml(
            c.name || "نام نہیں"
          )}
        </strong>

        <span>
          Customer #${escapeHtml(
            c.customerNo || "-"
          )}
          ·
          ${escapeHtml(
            c.phone || "نمبر نہیں"
          )}
        </span>

        <small>
          ${escapeHtml(c.area || "")}
        </small>
      </div>

      <div class="chevron">‹</div>
    </button>
  `).join("");
}

function statusLabel(status) {
  return ({
    pending: [
      "Pending",
      "pending"
    ],

    unpaid: [
      "Complete / Unpaid",
      "unpaid"
    ],

    paid: [
      "Complete / Paid",
      "paid"
    ]

  }[status] || [
    "Unknown",
    "pending"
  ]);
}

function renderOrders() {
  const list = $("ordersList");

  if (!list) return;

  let filtered = [...orders];

  if (activeOrderFilter !== "all") {
    filtered =
      filtered.filter(
        o => o.status === activeOrderFilter
      );
  }

  if (!filtered.length) {
    list.innerHTML =
      `<div class="empty">
        اس حصے میں کوئی آرڈر نہیں ہے۔
      </div>`;

    return;
  }

  list.innerHTML = filtered.map(o => {
    const [label, cls] =
      statusLabel(o.status);

    return `
      <article class="order-card">

        <div class="order-top">

          <div>
            <strong>
              ${escapeHtml(
                o.customerName ||
                "نیا کسٹمر"
              )}
            </strong>

            <span>
              #${escapeHtml(
                o.customerNo || "NEW"
              )}
              ·
              ${escapeHtml(
                o.colorName || "رنگ نہیں"
              )}
            </span>
          </div>

          <span class="status ${cls}">
            ${label}
          </span>

        </div>

        <div class="color-row">

          <span
            class="color-dot"
            style="background:${escapeHtml(
              o.colorHex || "#ffffff"
            )}"
          ></span>

          <span>
            Order:
            ${dateText(o.createdAtIso)}
          </span>

          <span>
            Delivery:
            ${dateText(o.deliveryDate)}
          </span>

        </div>

        <div class="order-money">

          <span>
            کل:
            <b>
              ${money(o.totalPrice)}
            </b>
          </span>

          <span>
            وصول:
            <b>
              ${money(o.received)}
            </b>
          </span>

          <span>
            باقی:
            <b>
              ${money(o.remaining)}
            </b>
          </span>

        </div>

        <div class="order-actions">

          ${
            o.status === "pending"
              ? `
                <button
                  class="secondary-btn"
                  data-order-complete="${o.id}"
                >
                  کپڑے مکمل
                </button>
              `
              : ""
          }

          ${
            o.status !== "paid"
              ? `
                <button
                  class="secondary-btn"
                  data-order-pay="${o.id}"
                >
                  Payment Update
                </button>
              `
              : ""
          }

          ${
            o.status === "unpaid"
              ? `
                <button
                  class="primary-btn small"
                  data-order-deliver="${o.id}"
                >
                  کپڑے دے دیے
                </button>
              `
              : ""
          }

          <button
            class="ghost-btn small"
            data-order-history="${o.customerId || ""}"
          >
            Customer
          </button>

        </div>

      </article>
    `;
  }).join("");
}

function renderHistory(customerId) {
  const c =
    customers.find(
      x => x.id === customerId
    );

  if (!c) return;

  $("historyCustomerName").textContent =
    `${c.name || "کسٹمر"} · #${c.customerNo || "-"}`;

  $("historyCustomerMeta").textContent =
    `${c.phone || "نمبر نہیں"} · ${c.area || ""}`;

  const m =
    c.measurements || {};

  $("historyMeasurements").innerHTML = `
    <h3>📏 محفوظ ناپ</h3>

    <div class="history-measurements">

      ${
        Object.entries({
          "لمبائی": m.length,
          "تیرا": m.tera,
          "آستین": m.sleeve,
          "گلہ": m.neck,
          "چھاتی": m.chest,
          "کمر": m.waist,
          "دامن": m.daman,
          "شلوار لمبائی": m.shalwarLength,
          "پانچہ": m.panja
        })
        .map(
          ([k, v]) =>
            `<div>
              <small>${k}</small>
              <b>${escapeHtml(v || "-")}</b>
            </div>`
        )
        .join("")
      }

    </div>

    <div class="design-summary">
      <b>Design:</b>
      ${escapeHtml(
        JSON.stringify(c.design || {})
      )}
    </div>
  `;

  const customerOrders =
    orders.filter(
      o => o.customerId === customerId
    );

  $("historyOrders").innerHTML =
    customerOrders.length

      ? customerOrders.map(o => {
          const [label, cls] =
            statusLabel(o.status);

          return `
            <article class="order-card">

              <div class="order-top">

                <div>
                  <strong>
                    ${dateText(
                      o.createdAtIso
                    )}
                  </strong>

                  <span>
                    ${escapeHtml(
                      o.colorName || "رنگ"
                    )}
                  </span>
                </div>

                <span class="status ${cls}">
                  ${label}
                </span>

              </div>

              <div class="order-money">

                <span>
                  کل:
                  <b>
                    ${money(o.totalPrice)}
                  </b>
                </span>

                <span>
                  وصول:
                  <b>
                    ${money(o.received)}
                  </b>
                </span>

                <span>
                  باقی:
                  <b>
                    ${money(o.remaining)}
                  </b>
                </span>

              </div>

              <small>
                Delivery:
                ${dateText(
                  o.deliveredAtIso ||
                  o.deliveryDate
                )}
              </small>

            </article>
          `;
        }).join("")

      : `
        <div class="empty">
          ابھی کوئی آرڈر نہیں۔
        </div>
      `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(
      /[&<>"']/g,
      c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[c])
    );
}

function fillOrderFromCustomer(c) {
  $("orderCustomerId").value =
    c.id;

  $("orderCustomerSearch").value =
    `${c.name} — #${c.customerNo}`;

  $("selectedCustomerCard")
    .classList.remove("hidden");

  $("selectedCustomerCard").innerHTML = `
    <strong>
      ${escapeHtml(c.name)}
    </strong>

    <span>
      #${escapeHtml(c.customerNo)}
      ·
      ${escapeHtml(
        c.phone || "نمبر نہیں"
      )}
    </span>
  `;

  $("customerSuggestions").innerHTML =
    "";

  setMeasurements(
    c.measurements || {},
    "o"
  );

  setOrderDesign(
    c.design || {}
  );
}

function clearOrderForm() {
  $("orderForm").reset();

  $("orderCustomerId").value =
    "";

  $("selectedCustomerCard")
    .classList.add("hidden");

  $("customerSuggestions").innerHTML =
    "";

  $("remainingPreview").value =
    0;

  $("orderCustomerSearch").value =
    "";

  $("newOrderCustomerBox")
    .classList.add("hidden");

  $("existingCustomerBox")
    .classList.remove("hidden");
}

/*
  Google Login
  GitHub Pages اور mobile browser کے لیے
  Redirect Login استعمال کیا گیا ہے۔
*/

$("googleLoginBtn")
  .addEventListener(
    "click",
    async () => {
      try {
        await signInWithRedirect(
          auth,
          provider
        );
      } catch (e) {
        console.error(
          "Google Redirect Login Error:",
          e
        );

        toast(
          `Google Login ناکام: ${e.message}`,
          "error"
        );
      }
    }
  );

$("logoutBtn")
  .addEventListener(
    "click",
    async () => {
      try {
        await signOut(auth);
      } catch (e) {
        console.error(e);
        toast(
          `Logout ناکام: ${e.message}`,
          "error"
        );
      }
    }
  );

$("menuBtn")
  .addEventListener(
    "click",
    () =>
      $("menuPanel")
        .classList
        .toggle("hidden")
  );

qsa("[data-view]")
  .forEach(btn => {

    btn.addEventListener(
      "click",
      () => {

        const view =
          btn.dataset.view;

        if (view === "new-order") {
          clearOrderForm();
        }

        showView(view);
      }
    );

  });

$("customerSearch")
  .addEventListener(
    "input",
    renderCustomers
  );

$("addCustomerBtn")
  .addEventListener(
    "click",
    () => {

      $("customerForm").reset();

      $("customerId").value =
        "";

      $("customerFormTitle")
        .textContent =
        "نیا کسٹمر";

      $("deleteCustomerBtn")
        .classList
        .add("hidden");

      showView(
        "customerForm"
      );
    }
  );

$("customerList")
  .addEventListener(
    "click",
    e => {

      const card =
        e.target.closest(
          "[data-customer-id]"
        );

      if (!card) return;

      const c =
        customers.find(
          x =>
            x.id ===
            card.dataset.customerId
        );

      if (!c) return;

      $("customerId").value =
        c.id;

      $("customerFormTitle")
        .textContent =
        `${c.name} — #${c.customerNo}`;

      $("customerName").value =
        c.name || "";

      $("customerPhone").value =
        c.phone || "";

      $("customerArea").value =
        c.area || "";

      setMeasurements(
        c.measurements || {},
        ""
      );

      setCustomerDesign(
        c.design || {}
      );

      $("deleteCustomerBtn")
        .classList
        .remove("hidden");

      showView(
        "customerForm"
      );
    }
  );

$("customerForm")
  .addEventListener(
    "submit",
    async e => {

      e.preventDefault();

      try {

        const id =
          $("customerId").value ||
          uidShort();

        const existing =
          customers.find(
            c => c.id === id
          );

        const data = {

          name:
            $("customerName")
              .value
              .trim(),

          phone:
            $("customerPhone")
              .value
              .trim(),

          area:
            $("customerArea")
              .value
              .trim(),

          customerNo:
            existing?.customerNo ||
            customerNumber(),

          measurements:
            getMeasurements("m"),

          design:
            getCustomerDesign(),

          updatedAtIso:
            nowIso()
        };

        await setDoc(
          doc(
            customersCol(),
            id
          ),
          {
            ...data,
            updatedAt:
              serverTimestamp()
          },
          {
            merge: true
          }
        );

        toast(
 
