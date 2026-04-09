/* Frontend auth UX + Django API (JWT).
   - Register -> Confirm remains simulated on frontend.
   - Real account creation/login/reset happen via Django endpoints.
   - JWT stored in localStorage (temporary per requirement). */

(function () {
  const STORAGE_KEYS = {
    session: "sfr_session",
    pending: "sfr_pending_user",
    confirm: "sfr_confirm_code",
    reset: "sfr_reset_code",
  };

  const UI_KEYS = {
    hasRegistered: "sfr_has_registered",
    authModalMode: "sfr_auth_modal_mode",
  };

  function computeDefaultApiBase() {
    try {
      const host = window.location.hostname || "";
      // Local dev (Live Server, etc.)
      if (host === "localhost" || host === "127.0.0.1") return "http://127.0.0.1:8000";

      // Production: frontend is deployed separately (e.g. Vercel) and must call the Render API.
      return "https://smart-fix-and-recycle-uganda.onrender.com";
    } catch {
      return "http://127.0.0.1:8000";
    }
  }

  const API_BASE =
    window.SFR_API_BASE ||
    localStorage.getItem("SFR_API_BASE") ||
    computeDefaultApiBase();

  async function api(path, opts) {
    const res = await fetch(API_BASE + path, {
      method: opts?.method || "GET",
      headers: opts?.headers || {},
      body: opts?.body,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { detail: text };
    }
    if (!res.ok) {
      const msg = data?.detail || "Request failed.";
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function getQueryParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch {
      return null;
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeEmail(email) {
    return (email || "").trim().toLowerCase();
  }

  function genUserId(users) {
    const nums = users
      .map((u) => u && u.id && String(u.id).match(/^USER-(\d+)$/))
      .filter(Boolean)
      .map((m) => Number(m[1]))
      .filter((n) => Number.isFinite(n));
    const next = (nums.length ? Math.max(...nums) : 1000) + 1;
    return `USER-${next}`;
  }

  function genCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function setAlert(el, type, msg) {
    if (!el) return;
    el.classList.remove("hidden");
    const modalAlert =
      el.id === "sfrAuthAlert" || (el.classList && el.classList.contains("sfr-light-alert"));
    el.classList.remove(
      "border-green-500/30",
      "text-green-300",
      "border-red-500/30",
      "text-red-300",
      "border-yellow-500/30",
      "text-yellow-200",
      "border-emerald-200",
      "bg-emerald-50",
      "text-emerald-900",
      "border-red-200",
      "bg-red-50",
      "text-red-800",
      "border-amber-200",
      "bg-amber-50",
      "text-amber-900"
    );
    if (modalAlert) {
      if (type === "success") el.classList.add("border-emerald-200", "bg-emerald-50", "text-emerald-900");
      if (type === "error") el.classList.add("border-red-200", "bg-red-50", "text-red-800");
      if (type === "warn") el.classList.add("border-amber-200", "bg-amber-50", "text-amber-900");
    } else {
      if (type === "success") el.classList.add("border-green-500/30", "text-green-300");
      if (type === "error") el.classList.add("border-red-500/30", "text-red-300");
      if (type === "warn") el.classList.add("border-yellow-500/30", "text-yellow-200");
    }
    el.textContent = msg;
  }

  function hideAlert(el) {
    if (!el) return;
    el.classList.add("hidden");
    el.textContent = "";
  }

  function getSession() {
    const s = readJson(STORAGE_KEYS.session, null);
    if (!s || typeof s !== "object") return null;
    if (!s.isLoggedIn) return null;
    return s;
  }

  function setSession(session) {
    writeJson(STORAGE_KEYS.session, session);
  }

  async function refreshMeIntoSession() {
    const s = getSession();
    if (!s?.access) return null;
    try {
      const me = await api("/api/me/dashboard/", {
        method: "GET",
        headers: { Authorization: `Bearer ${s.access}` },
      });

      const nameFromMe = (() => {
        const fn = (me?.user?.first_name || "").trim();
        const ln = (me?.user?.last_name || "").trim();
        const full = `${fn} ${ln}`.trim();
        if (full) return full;
        if (fn) return fn;
        // Last resort: use email local-part if present
        const email = String(me?.user?.email || s.email || "");
        return email ? email.split("@")[0] : (s.firstName || "User");
      })();

      const updates = {
        email: me?.user?.email || s.email || "",
        role: me?.user?.is_admin ? "admin" : "user",
        firstName: nameFromMe,
        counts: {
          support_total: Number(me?.support?.total ?? 0),
          support_pending: Number(me?.support?.pending ?? 0),
          pickup_total: Number(me?.pickups?.total ?? 0),
          pickup_pending: Number(me?.pickups?.scheduled ?? 0),
        },
      };
      setSession({ ...s, ...updates });
      return { ...s, ...updates };
    } catch {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.session);
  }

  function redirect(to) {
    window.location.href = to;
  }

  function basePathToRoot() {
    // pages/* should link back using ../
    const p = window.location.pathname.replace(/\\/g, "/");
    return p.includes("/pages/") ? "../" : "./";
  }

  /** Brand logo (static path under site root). */
  function logoUrl() {
    return `${basePathToRoot()}images/logo.png`;
  }

  function getLoginUrl() {
    return `${basePathToRoot()}pages/login.html`;
  }

  function getRegisterUrl() {
    return `${basePathToRoot()}pages/register.html`;
  }

  function getConfirmUrl() {
    return `${basePathToRoot()}pages/confirm.html`;
  }

  function getUserDashboardUrl() {
    return `${basePathToRoot()}dashboard.html`;
  }

  function getAdminDashboardUrl() {
    return `${basePathToRoot()}pages/admin_dashboard.html`;
  }

  function getLoginPageUrl() {
    return `${basePathToRoot()}pages/login.html`;
  }

  function getRegisterPageUrl() {
    return `${basePathToRoot()}pages/register.html`;
  }

  function setHasRegistered() {
    try {
      localStorage.setItem(UI_KEYS.hasRegistered, "1");
    } catch {}
  }

  function hasRegisteredBefore() {
    try {
      return localStorage.getItem(UI_KEYS.hasRegistered) === "1";
    } catch {
      return false;
    }
  }

  function mountAuthModalOnce() {
    if (document.getElementById("sfrAuthModal")) return;

    const inp =
      "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-snug text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400 outline-none transition focus:border-orange-400 focus:bg-white focus:shadow-[inset_0_1px_2px_rgba(251,146,60,0.06)] focus:ring-2 focus:ring-orange-400/25";
    const lbl = "mb-1.5 block text-xs font-bold tracking-tight text-slate-900";

    const modal = document.createElement("div");
    modal.id = "sfrAuthModal";
    modal.className =
      "fixed inset-0 z-[9999] hidden items-center justify-center px-4 py-6 sm:py-8";
    modal.innerHTML = `
      <div id="sfrAuthBackdrop" class="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]"></div>
      <div id="sfrAuthCard" class="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200/90 bg-white text-slate-900 shadow-[0_20px_40px_-12px_rgba(15,23,42,0.2)] ring-1 ring-slate-900/[0.04]">
        <div class="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-5 py-4">
          <div class="flex min-w-0 flex-1 items-start gap-3 pr-1">
            <img src="${logoUrl()}" alt="" class="brand-mark-nav" width="64" height="64" loading="lazy" />
          <div class="min-w-0">
            <div class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Smart Fix & Recycle</div>
            <div id="sfrAuthTitle" class="mt-1.5 text-lg font-bold leading-tight tracking-tight text-slate-900 sm:text-xl">Welcome</div>
            <p id="sfrAuthSubtitle" class="mt-1.5 text-xs leading-snug text-slate-600 sm:text-[13px]"></p>
          </div>
          </div>
          <button type="button" id="sfrAuthClose" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-base leading-none text-slate-400 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700" aria-label="Close dialog">&times;</button>
        </div>

        <div class="px-5 py-5">
          <div id="sfrAuthAlert" class="mb-4 hidden rounded-lg border p-3 text-sm leading-snug"></div>

          <!-- Login -->
          <form id="sfrLoginForm" class="space-y-4">
            <div>
              <label class="${lbl}" for="sfrLoginEmail">Email</label>
              <input id="sfrLoginEmail" name="email" type="email" autocomplete="email" placeholder="you@example.com" required class="${inp}"/>
            </div>
            <div>
              <label class="${lbl}" for="sfrLoginPassword">Password</label>
              <input id="sfrLoginPassword" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required class="${inp}"/>
            </div>
            <button type="submit" class="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-bold text-slate-900 shadow-md shadow-orange-500/20 transition hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1">Log in</button>
            <div class="flex flex-col gap-3 border-t border-slate-200/90 pt-4 text-xs sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 sm:text-sm">
              <button type="button" id="sfrOpenForgot" class="text-left text-slate-600 transition hover:text-orange-600">Forgot password?</button>
              <p class="text-slate-500 sm:text-right">
                New here?
                <button type="button" id="sfrSwitchToSignup" class="ml-1 font-bold text-slate-900 underline decoration-slate-300 decoration-1 underline-offset-4 transition hover:text-orange-600 hover:decoration-orange-400">Create an account</button>
              </p>
            </div>
          </form>

          <!-- Signup -->
          <form id="sfrSignupForm" class="hidden space-y-4">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div>
                <label class="${lbl}" for="sfrSuFirst">First name</label>
                <input id="sfrSuFirst" name="firstName" type="text" placeholder="e.g. Claire" required class="${inp}"/>
              </div>
              <div>
                <label class="${lbl}" for="sfrSuLast">Last name</label>
                <input id="sfrSuLast" name="lastName" type="text" placeholder="e.g. Atuhe" required class="${inp}"/>
              </div>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div>
                <label class="${lbl}" for="sfrSuEmail">Email</label>
                <input id="sfrSuEmail" name="email" type="email" placeholder="claire@example.com" required class="${inp}"/>
              </div>
              <div>
                <label class="${lbl}" for="sfrSuPhone">Phone</label>
                <input id="sfrSuPhone" name="phone" type="tel" placeholder="+256 7XX XXX XXX" required class="${inp}"/>
              </div>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div>
                <label class="${lbl}" for="sfrSuPass">Password</label>
                <input id="sfrSuPass" name="password" type="password" placeholder="At least 6 characters" required class="${inp}"/>
              </div>
              <div>
                <label class="${lbl}" for="sfrSuConfirm">Confirm password</label>
                <input id="sfrSuConfirm" name="confirmPassword" type="password" placeholder="Repeat password" required class="${inp}"/>
              </div>
            </div>
            <button type="submit" class="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-bold text-slate-900 shadow-md shadow-orange-500/20 transition hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1">Create account</button>
            <p class="border-t border-slate-200/90 pt-4 text-center text-xs text-slate-500 sm:text-sm">
              Already have an account?
              <button type="button" id="sfrSwitchToLogin" class="ml-1 font-bold text-slate-900 underline decoration-slate-300 decoration-1 underline-offset-4 transition hover:text-orange-600 hover:decoration-orange-400">Log in</button>
            </p>
          </form>

          <!-- Forgot -->
          <form id="sfrForgotForm" class="hidden space-y-4">
            <p class="text-xs leading-relaxed text-slate-600 sm:text-sm">We’ll email you a 6-digit code. Use it below to set a new password.</p>

            <div id="sfrForgotStage1">
              <label class="${lbl}" for="sfrForgotEmail">Email</label>
              <input id="sfrForgotEmail" name="email" type="email" placeholder="you@example.com" required class="${inp}"/>
            </div>

            <div id="sfrForgotStage2" class="hidden space-y-4">
              <div>
                <label class="${lbl}" for="sfrForgotCode">Reset code</label>
                <input id="sfrForgotCode" name="code" inputmode="numeric" maxlength="6" placeholder="6-digit code" class="${inp}"/>
              </div>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div>
                  <label class="${lbl}" for="sfrForgotNew">New password</label>
                  <input id="sfrForgotNew" name="newPassword" type="password" placeholder="New password" class="${inp}"/>
                </div>
                <div>
                  <label class="${lbl}" for="sfrForgotNew2">Confirm new password</label>
                  <input id="sfrForgotNew2" name="confirmNewPassword" type="password" placeholder="Confirm password" class="${inp}"/>
                </div>
              </div>
            </div>

            <button type="submit" class="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-bold text-slate-900 shadow-md shadow-orange-500/20 transition hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1">Continue</button>
            <p class="border-t border-slate-200/90 pt-4 text-center text-xs text-slate-500 sm:text-sm">
              <button type="button" id="sfrBackToLogin" class="font-bold text-slate-900 underline decoration-slate-300 decoration-1 underline-offset-4 transition hover:text-orange-600 hover:decoration-orange-400">Back to log in</button>
            </p>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById("sfrAuthClose");
    const backdrop = document.getElementById("sfrAuthBackdrop");
    closeBtn?.addEventListener("click", () => closeAuthModal());
    backdrop?.addEventListener("click", () => closeAuthModal());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAuthModal();
    });

    document.getElementById("sfrSwitchToSignup")?.addEventListener("click", () => openAuthModal("signup"));
    document.getElementById("sfrSwitchToLogin")?.addEventListener("click", () => openAuthModal("login"));
    document.getElementById("sfrOpenForgot")?.addEventListener("click", () => openAuthModal("forgot"));
    document.getElementById("sfrBackToLogin")?.addEventListener("click", () => openAuthModal("login"));

    // Wire up modal forms using existing logic patterns.
    document.getElementById("sfrLoginForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target;
      const alertEl = document.getElementById("sfrAuthAlert");
      hideAlert(alertEl);
      const emailOrUser = (form.email.value || "").trim();
      const password = form.password.value || "";
      if (!emailOrUser || !password) {
        setAlert(alertEl, "error", "Please enter your email and password.");
        return;
      }

      (async () => {
        try {
          const verifyToken = getQueryParam("verify");
          if (verifyToken) {
            await api(`/api/auth/verify-email/?token=${encodeURIComponent(verifyToken)}`);
            setAlert(alertEl, "success", "Email verified. You can now login.");
            window.history.replaceState({}, document.title, window.location.pathname);
          }

          const username = emailOrUser.includes("@") ? normalizeEmail(emailOrUser) : emailOrUser;
          const tokens = await api("/api/auth/token/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });

          const me = await api("/api/me/dashboard/", {
            method: "GET",
            headers: { Authorization: `Bearer ${tokens.access}` },
          });

          const isAdmin = Boolean(me?.user?.is_admin);
          const fn = String(me?.user?.first_name || "").trim();
          const ln = String(me?.user?.last_name || "").trim();
          const full = `${fn} ${ln}`.trim();
          const displayName = full || fn || String(me?.user?.email || "").split("@")[0] || "User";
          setSession({
            isLoggedIn: true,
            userId: isAdmin ? "ADMIN" : "USER",
            firstName: displayName,
            role: isAdmin ? "admin" : "user",
            email: me?.user?.email || "",
            access: tokens.access,
            refresh: tokens.refresh,
            counts: {
              support_total: Number(me?.support?.total ?? 0),
              support_pending: Number(me?.support?.pending ?? 0),
              pickup_total: Number(me?.pickups?.total ?? 0),
              pickup_pending: Number(me?.pickups?.scheduled ?? 0),
            },
            loggedInAt: nowIso(),
          });

          closeAuthModal();

          const after = localStorage.getItem("sfr_redirect_after_login");
          if (after) {
            localStorage.removeItem("sfr_redirect_after_login");
            redirect(after);
            return;
          }
          redirect(isAdmin ? getAdminDashboardUrl() : getUserDashboardUrl());
        } catch (err) {
          setAlert(alertEl, "error", err.message || "Login failed.");
        }
      })();
    });

    document.getElementById("sfrSignupForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target;
      const alertEl = document.getElementById("sfrAuthAlert");
      hideAlert(alertEl);

      const firstName = (form.firstName.value || "").trim();
      const lastName = (form.lastName.value || "").trim();
      const email = normalizeEmail(form.email.value);
      const phone = (form.phone.value || "").trim();
      const password = form.password.value || "";
      const confirmPassword = form.confirmPassword.value || "";

      if (!firstName || !lastName || !email || !phone || !password || !confirmPassword) {
        setAlert(alertEl, "error", "Please fill in all required fields.");
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        setAlert(alertEl, "error", "Please enter a valid email address.");
        return;
      }
      if (password.length < 6) {
        setAlert(alertEl, "error", "Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setAlert(alertEl, "error", "Passwords do not match.");
        return;
      }

      const pending = {
        firstName,
        lastName,
        email,
        phone,
        password,
        isVerified: false,
        createdAt: nowIso(),
      };

      writeJson(STORAGE_KEYS.pending, pending);
      setHasRegistered();
      writeJson(UI_KEYS.authModalMode, "signup");
      redirect(getConfirmUrl());
    });

    // Forgot password modal uses existing stage logic; keep state in STORAGE_KEYS.reset.
    document.getElementById("sfrForgotForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target;
      const alertEl = document.getElementById("sfrAuthAlert");
      hideAlert(alertEl);

      const stage1 = document.getElementById("sfrForgotStage1");
      const stage2 = document.getElementById("sfrForgotStage2");

      const email = normalizeEmail(form.email.value);
      const code = String(form.code?.value || "").trim();
      const newPassword = form.newPassword?.value || "";
      const confirmPassword = form.confirmNewPassword?.value || "";
      const reset = readJson(STORAGE_KEYS.reset, null);

      // Stage 1: request reset code
      if (!reset) {
        if (!email) {
          setAlert(alertEl, "error", "Enter your email address.");
          return;
        }
        (async () => {
          try {
            await api("/api/auth/forgot-password/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            writeJson(STORAGE_KEYS.reset, { email, createdAt: nowIso() });
            stage1?.classList.add("hidden");
            stage2?.classList.remove("hidden");
            setAlert(alertEl, "success", "Reset code sent. Check your email inbox (and Spam).");
          } catch (err) {
            setAlert(alertEl, "error", err.message || "Could not start password reset.");
          }
        })();
        return;
      }

      // Stage 2: confirm reset
      if (normalizeEmail(reset.email) !== email) {
        setAlert(alertEl, "error", "Email does not match reset request.");
        return;
      }
      if (!/^\d{6}$/.test(code)) {
        setAlert(alertEl, "error", "Enter the 6-digit reset code from your email.");
        return;
      }
      if (newPassword.length < 6) {
        setAlert(alertEl, "error", "New password must be at least 6 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setAlert(alertEl, "error", "Passwords do not match.");
        return;
      }

      (async () => {
        try {
          await api("/api/auth/reset-password/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code, newPassword }),
          });
          localStorage.removeItem(STORAGE_KEYS.reset);
          setAlert(alertEl, "success", "Password updated. You can now login.");
          stage2?.classList.add("hidden");
          stage1?.classList.remove("hidden");
          openAuthModal("login");
        } catch (err) {
          setAlert(alertEl, "error", err.message || "Could not reset password.");
        }
      })();
    });
  }

  function openAuthModal(mode) {
    mountAuthModalOnce();
    const modal = document.getElementById("sfrAuthModal");
    const title = document.getElementById("sfrAuthTitle");
    const subtitle = document.getElementById("sfrAuthSubtitle");
    const loginForm = document.getElementById("sfrLoginForm");
    const signupForm = document.getElementById("sfrSignupForm");
    const forgotForm = document.getElementById("sfrForgotForm");
    const alertEl = document.getElementById("sfrAuthAlert");
    hideAlert(alertEl);

    modal?.classList.remove("hidden");
    modal?.classList.add("flex");

    const m = mode || "login";
    try {
      localStorage.setItem(UI_KEYS.authModalMode, m);
    } catch {}

    const setActive = (which) => {
      const isLogin = which === "login";
      const isSignup = which === "signup";
      const isForgot = which === "forgot";

      const card = document.getElementById("sfrAuthCard");
      if (card) {
        card.classList.remove("max-w-md", "max-w-xl");
        card.classList.add(isSignup ? "max-w-xl" : "max-w-md");
      }

      title.textContent = isSignup ? "Create your account" : isForgot ? "Reset your password" : "Welcome back";
      if (subtitle) {
        if (isLogin) {
          subtitle.textContent = "";
          subtitle.classList.add("hidden");
        } else {
          subtitle.classList.remove("hidden");
          subtitle.textContent = isSignup
            ? "Join to schedule pickups, get IT help, and track your requests."
            : "We’ll send a reset code to your email address.";
        }
      }

      loginForm?.classList.toggle("hidden", !isLogin);
      signupForm?.classList.toggle("hidden", !isSignup);
      forgotForm?.classList.toggle("hidden", !isForgot);
    };

    setActive(m);
  }

  function closeAuthModal() {
    const modal = document.getElementById("sfrAuthModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  function requireAuth(opts) {
    const { role } = opts || {};
    const s = getSession();
    if (!s) {
      localStorage.setItem("sfr_redirect_after_login", window.location.href);
      redirect(getLoginUrl());
      return false;
    }
    if (role && s.role !== role) {
      redirect(`${basePathToRoot()}index.html?denied=1`);
      return false;
    }
    return true;
  }

  function logout() {
    clearSession();
    redirect(`${basePathToRoot()}index.html`);
  }

  async function apiCreateSupport(payload) {
    const s = getSession();
    if (!s?.access) throw new Error("Not logged in.");
    return api("/api/support/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${s.access}`,
      },
      body: JSON.stringify(payload),
    });
  }

  async function apiCreatePickup(payload) {
    const s = getSession();
    if (!s?.access) throw new Error("Not logged in.");
    return api("/api/pickups/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${s.access}`,
      },
      body: JSON.stringify(payload),
    });
  }

  function mountNavbar(targetId) {
    const slot = document.getElementById(targetId);
    if (!slot) return;

    const s = getSession();
    if (!s) {
      const isNew = !hasRegisteredBefore();
      slot.innerHTML = `
        <div class="relative inline-block w-max max-w-full shrink-0" id="sfrGuestWrap">
          <button type="button" id="sfrGuestBtn" class="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm ring-1 ring-slate-200/80">👤</span>
            <span class="text-slate-400 text-xs">▾</span>
          </button>
          <div id="sfrGuestDropdownHost" class="pointer-events-none absolute right-0 top-full z-[999] w-64 pt-2 origin-top-right">
            <div id="sfrGuestMenu" class="overflow-hidden rounded-2xl border border-slate-200 bg-white opacity-0 shadow-xl shadow-slate-900/10 scale-95 -translate-y-1 pointer-events-none transition duration-150 ease-out">
            <div class="border-b border-slate-100 px-4 py-3">
              <div class="text-xs font-medium text-slate-500">Welcome</div>
              <div class="mt-0.5 text-xs text-slate-600">${isNew ? "Create an account to get started." : "Log in to continue."}</div>
            </div>
            <div class="space-y-2 p-2">
              <button type="button" data-auth-open="${isNew ? "signup" : "login"}" class="w-full rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-slate-900 transition hover:bg-orange-400">
                ${isNew ? "Sign up" : "Log in"}
              </button>
              <button type="button" data-auth-open="${isNew ? "login" : "signup"}" class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                ${isNew ? "I already have an account" : "Create an account"}
              </button>
            </div>
            </div>
          </div>
        </div>
      `;

      const wrap = slot.querySelector("#sfrGuestWrap");
      const btn = slot.querySelector("#sfrGuestBtn");
      const menu = slot.querySelector("#sfrGuestMenu");
      const dropdownHost = slot.querySelector("#sfrGuestDropdownHost");
      const openMenu = () => {
        dropdownHost?.classList.remove("pointer-events-none");
        menu.classList.remove("opacity-0", "scale-95", "-translate-y-1", "pointer-events-none");
        menu.classList.add("opacity-100", "scale-100", "translate-y-0");
      };
      const closeMenu = () => {
        menu.classList.add("opacity-0", "scale-95", "-translate-y-1", "pointer-events-none");
        menu.classList.remove("opacity-100", "scale-100", "translate-y-0");
        dropdownHost?.classList.add("pointer-events-none");
      };

      btn?.addEventListener("click", (e) => {
        e.preventDefault();
        if (menu.classList.contains("pointer-events-none")) openMenu();
        else closeMenu();
      });
      wrap?.addEventListener("mouseenter", openMenu);
      wrap?.addEventListener("mouseleave", closeMenu);

      slot.querySelectorAll("[data-auth-open]").forEach((el) => {
        el.addEventListener("click", () => {
          closeMenu();
          openAuthModal(el.getAttribute("data-auth-open"));
        });
      });
      return;
    }

    // If counts aren't loaded yet, fetch once and re-render.
    if (!s.counts) {
      refreshMeIntoSession().then(() => mountNavbar(targetId));
    }

    const menuItems =
      s.role === "admin"
        ? [
            { label: "Admin Dashboard", icon: "🛠", href: getAdminDashboardUrl() },
            { label: "Manage Users", icon: "👥", href: getAdminDashboardUrl() + "#users" },
            { label: "Manage Tickets", icon: "🎟", href: getAdminDashboardUrl() + "#tickets" },
            { label: "Pickup Requests", icon: "♻", href: getAdminDashboardUrl() + "#pickups" },
            { label: "Payments", icon: "💳", href: getAdminDashboardUrl() + "#payments" },
            { label: "Reports", icon: "📈", href: getAdminDashboardUrl() + "#reports" },
          ]
        : [
            { label: "My Dashboard", icon: "👤", href: getUserDashboardUrl() },
            { label: "My Tickets", icon: "🎟", href: getUserDashboardUrl() + "#tickets" },
            { label: "My Pickup Requests", icon: "♻", href: getUserDashboardUrl() + "#pickups" },
            { label: "Payment History", icon: "💳", href: getUserDashboardUrl() + "#payments" },
            { label: "Account Settings", icon: "⚙", href: getUserDashboardUrl() + "#settings" },
          ];

    const menuHtml = menuItems
      .map(
        (i) => `
        <a href="${i.href}" class="sfr-menu-item flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100">
          <span class="text-sm">${i.icon}</span>
          <span>${i.label}</span>
        </a>`
      )
      .join("");

    const pendingSupport = Number(s?.counts?.support_pending ?? 0);
    const pendingPickups = Number(s?.counts?.pickup_pending ?? 0);
    const badgeText =
      pendingSupport > 0
        ? `${pendingSupport} Active Request${pendingSupport === 1 ? "" : "s"}`
        : pendingPickups > 0
        ? `${pendingPickups} Pending Pickup${pendingPickups === 1 ? "" : "s"}`
        : "";

    slot.innerHTML = `
      <div class="relative inline-block w-max max-w-full shrink-0" id="sfrProfileWrap">
        <button type="button" id="sfrProfileBtn" class="flex max-w-[min(100%,20rem)] items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm ring-1 ring-slate-200/80">👤</span>
          <span class="hidden min-w-0 truncate text-xs text-slate-600 sm:block">Hi, <span class="font-semibold text-slate-900">${escapeHtml(s.firstName || "User")}</span></span>
          ${
            badgeText
              ? `<span class="hidden shrink-0 items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-800 sm:inline-flex">${escapeHtml(
                  badgeText
                )}</span>`
              : ""
          }
          <span class="shrink-0 text-slate-400 text-xs">▾</span>
        </button>
        <div id="sfrProfileDropdownHost" class="pointer-events-none absolute right-0 top-full z-[999] w-64 min-w-[16rem] pt-2 origin-top-right">
          <div id="sfrProfileMenu" class="overflow-hidden rounded-2xl border border-slate-200 bg-white opacity-0 shadow-xl shadow-slate-900/10 scale-95 -translate-y-1 pointer-events-none transition duration-150 ease-out">
          <div class="border-b border-slate-100 px-4 py-3">
            <div class="text-xs font-medium text-slate-500">Signed in</div>
            <div class="mt-0.5 truncate text-sm font-semibold text-slate-900">${escapeHtml(s.firstName || "User")}</div>
            <div class="truncate text-xs text-slate-500">${escapeHtml(s.email || "")}</div>
          </div>
          <div class="p-1.5">
            ${menuHtml}
          </div>
          <div class="border-t border-slate-100 p-1.5">
            <button type="button" id="sfrLogoutBtn" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50">
              <span class="text-sm">🚪</span><span>Log out</span>
            </button>
          </div>
          </div>
        </div>
      </div>
    `;

    const btn = document.getElementById("sfrProfileBtn");
    const menu = document.getElementById("sfrProfileMenu");
    const logoutBtn = document.getElementById("sfrLogoutBtn");
    const wrap = document.getElementById("sfrProfileWrap");
    const dropdownHost = document.getElementById("sfrProfileDropdownHost");

    function closeMenu() {
      menu.classList.add("opacity-0", "scale-95", "-translate-y-1", "pointer-events-none");
      menu.classList.remove("opacity-100", "scale-100", "translate-y-0");
      dropdownHost?.classList.add("pointer-events-none");
    }
    function toggleMenu() {
      const isOpen = !menu.classList.contains("pointer-events-none");
      if (isOpen) closeMenu();
      else openMenu();
    }
    function openMenu() {
      dropdownHost?.classList.remove("pointer-events-none");
      menu.classList.remove("opacity-0", "scale-95", "-translate-y-1", "pointer-events-none");
      menu.classList.add("opacity-100", "scale-100", "translate-y-0");
    }

    btn?.addEventListener("click", (e) => {
      e.preventDefault();
      toggleMenu();
    });
    wrap?.addEventListener("mouseenter", () => {
      openMenu();
    });
    wrap?.addEventListener("mouseleave", () => {
      closeMenu();
    });
    logoutBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) closeMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Pages
  function handleRegister(formId, alertId) {
    const form = document.getElementById(formId);
    const alert = document.getElementById(alertId);
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      hideAlert(alert);

      const firstName = form.firstName.value.trim();
      const lastName = form.lastName.value.trim();
      const email = normalizeEmail(form.email.value);
      const phone = form.phone.value.trim();
      const password = form.password.value;
      const confirmPassword = form.confirmPassword.value;

      if (!firstName || !lastName || !email || !phone || !password || !confirmPassword) {
        setAlert(alert, "error", "Please fill in all required fields.");
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        setAlert(alert, "error", "Please enter a valid email address.");
        return;
      }
      if (password.length < 6) {
        setAlert(alert, "error", "Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setAlert(alert, "error", "Passwords do not match.");
        return;
      }
      const pending = {
        firstName,
        lastName,
        email,
        phone,
        password,
        isVerified: false,
        createdAt: nowIso(),
      };

      writeJson(STORAGE_KEYS.pending, pending);
      setHasRegistered();
      redirect(getConfirmUrl());
    });
  }

  function handleConfirm(formId, alertId, hintId) {
    const form = document.getElementById(formId);
    const alert = document.getElementById(alertId);
    const hint = document.getElementById(hintId);
    if (!form) return;

    const pending = readJson(STORAGE_KEYS.pending, null);
    if (!pending) {
      setAlert(alert, "warn", "No pending registration found. Please register again.");
      setTimeout(() => redirect(getRegisterUrl()), 900);
      return;
    }

    if (hint) {
      hint.textContent = "Sending code…";
    }

    // Create the real (inactive) account in Django and trigger email verification.
    (async () => {
      try {
        await api("/api/auth/register/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: normalizeEmail(pending.email),
            email: pending.email,
            password: pending.password,
            firstName: pending.firstName,
            lastName: pending.lastName,
            phone: pending.phone,
          }),
        });
        hideAlert(alert);
        if (hint) hint.textContent = `Sent to ${pending.email}`;
      } catch (err) {
        if (hint) hint.textContent = "";
        setAlert(alert, "error", err.message || "Could not send email.");
      }
    })();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      hideAlert(alert);
      const code = String(form.code?.value || "").trim();
      if (!/^\d{6}$/.test(code)) {
        setAlert(alert, "error", "Enter the 6-digit code.");
        return;
      }
      (async () => {
        try {
          await api("/api/auth/verify-email-code/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: pending.email, code }),
          });
          hideAlert(alert);
          redirect(`${getLoginUrl()}?verified=1`);
        } catch (err) {
          setAlert(alert, "error", err.message || "Invalid code.");
        }
      })();
    });
  }

  function handleResendVerification(alertId) {
    const alert = document.getElementById(alertId);
    const pending = readJson(STORAGE_KEYS.pending, null);
    if (!pending?.email) {
      setAlert(alert, "error", "Register again to continue.");
      return;
    }

    (async () => {
      try {
        await api("/api/auth/resend-verification/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: pending.email }),
        });
        setAlert(alert, "success", "New code sent.");
      } catch (err) {
        setAlert(alert, "error", err.message || "Could not resend.");
      }
    })();
  }

  function handleLogin(formId, alertId) {
    const form = document.getElementById(formId);
    const alert = document.getElementById(alertId);
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      hideAlert(alert);

      const emailOrUser = (form.email.value || "").trim();
      const password = form.password.value;
      if (!emailOrUser || !password) {
        setAlert(alert, "error", "Please enter your email/username and password.");
        return;
      }

      (async () => {
        try {
          // If user arrives from verification link, verify first.
          const verifyToken = getQueryParam("verify");
          if (verifyToken) {
            await api(`/api/auth/verify-email/?token=${encodeURIComponent(verifyToken)}`);
            setAlert(alert, "success", "Email verified. You can now login.");
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
          }

          const username = emailOrUser.includes("@") ? normalizeEmail(emailOrUser) : emailOrUser;
          const tokens = await api("/api/auth/token/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });

          const me = await api("/api/me/dashboard/", {
            method: "GET",
            headers: { Authorization: `Bearer ${tokens.access}` },
          });

          const isAdmin = Boolean(me?.user?.is_admin);
          const fn = String(me?.user?.first_name || "").trim();
          const ln = String(me?.user?.last_name || "").trim();
          const full = `${fn} ${ln}`.trim();
          const displayName = full || fn || String(me?.user?.email || "").split("@")[0] || "User";
          setSession({
            isLoggedIn: true,
            userId: isAdmin ? "ADMIN" : "USER",
            firstName: displayName,
            role: isAdmin ? "admin" : "user",
            email: me?.user?.email || "",
            access: tokens.access,
            refresh: tokens.refresh,
            counts: {
              support_total: Number(me?.support?.total ?? 0),
              support_pending: Number(me?.support?.pending ?? 0),
              pickup_total: Number(me?.pickups?.total ?? 0),
              pickup_pending: Number(me?.pickups?.scheduled ?? 0),
            },
            loggedInAt: nowIso(),
          });

          const after = localStorage.getItem("sfr_redirect_after_login");
          if (after) {
            localStorage.removeItem("sfr_redirect_after_login");
            redirect(after);
            return;
          }
          redirect(isAdmin ? getAdminDashboardUrl() : getUserDashboardUrl());
        } catch (err) {
          setAlert(alert, "error", err.message || "Login failed.");
        }
      })();
    });
  }

  function handleForgot(formId, alertId, stageEls) {
    const form = document.getElementById(formId);
    const alert = document.getElementById(alertId);
    if (!form) return;

    const { stage1Id, stage2Id } = stageEls || {};
    const stage1 = stage1Id ? document.getElementById(stage1Id) : null;
    const stage2 = stage2Id ? document.getElementById(stage2Id) : null;

    function showStage(n) {
      if (stage1 && stage2) {
        stage1.classList.toggle("hidden", n !== 1);
        stage2.classList.toggle("hidden", n !== 2);
      }
    }

    showStage(1);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      hideAlert(alert);

      const email = normalizeEmail(form.email.value);
      const code = String(form.code?.value || "").trim();
      const newPassword = form.newPassword?.value || "";
      const confirmPassword = form.confirmNewPassword?.value || "";

      const reset = readJson(STORAGE_KEYS.reset, null);

      // Stage 1: request reset code
      if (!reset) {
        if (!email) {
          setAlert(alert, "error", "Enter your email address.");
          return;
        }
        (async () => {
          try {
            await api("/api/auth/forgot-password/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            writeJson(STORAGE_KEYS.reset, { email, createdAt: nowIso() });
            setAlert(alert, "success", "Reset code sent. Check your email inbox (and Spam).");
            showStage(2);
          } catch (err) {
            setAlert(alert, "error", err.message || "Could not start password reset.");
          }
        })();
        return;
      }

      // Stage 2: confirm reset
      if (normalizeEmail(reset.email) !== email) {
        setAlert(alert, "error", "Email does not match reset request.");
        return;
      }
      if (!/^\d{6}$/.test(code)) {
        setAlert(alert, "error", "Enter the 6-digit reset code from your email.");
        return;
      }
      if (newPassword.length < 6) {
        setAlert(alert, "error", "New password must be at least 6 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setAlert(alert, "error", "Passwords do not match.");
        return;
      }

      (async () => {
        try {
          await api("/api/auth/reset-password/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code, newPassword }),
          });
          localStorage.removeItem(STORAGE_KEYS.reset);
          setAlert(alert, "success", "Password updated. Redirecting to login…");
          setTimeout(() => redirect(getLoginUrl()), 900);
        } catch (err) {
          setAlert(alert, "error", err.message || "Could not reset password.");
        }
      })();
    });

    // If user refreshes while in stage2, keep stage2 visible
    if (readJson(STORAGE_KEYS.reset, null)) showStage(2);
  }

  // Auto-protect by data attributes
  function autoProtect() {
    const protect = document.body?.getAttribute("data-protect");
    if (!protect) return;
    if (protect === "auth") requireAuth();
    if (protect === "admin") requireAuth({ role: "admin" });
    if (protect === "user") requireAuth({ role: "user" });
  }

  function mountSiteNavbar(opts) {
    const o = opts || {};
    const targetId = o.targetId || "siteNav";
    const active = String(o.active || "").toLowerCase();
    const slot = document.getElementById(targetId);
    if (!slot) return;

    const activeCls = "text-orange-800 border-b-2 border-orange-700/50 pb-2";
    const linkCls =
      "inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-900/[0.04] hover:text-slate-900";
    const mobileLinkBase = "px-4 py-3 rounded-xl";

    function link(href, label, key) {
      const isActive = active === key;
      return `<a href="${href}" class="${linkCls} ${isActive ? activeCls : ""}">${label}</a>`;
    }

    function mobileLink(href, label, key) {
      const isActive = active === key;
      return `<a href="${href}" class="${mobileLinkBase} ${isActive ? "text-orange-800 font-semibold bg-slate-900/[0.03]" : "hover:bg-slate-900/[0.04]"}">${label}</a>`;
    }

    slot.innerHTML = `
      <nav class="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-3" style="background: linear-gradient(135deg, rgba(209, 250, 229, 0.52) 0%, rgba(204, 251, 241, 0.46) 45%, rgba(254, 243, 199, 0.5) 100%), rgba(255, 255, 255, 0.82); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid rgba(16, 185, 129, 0.14); box-shadow: 0 10px 28px rgba(6, 78, 59, 0.05);">
        <div class="max-w-7xl mx-auto flex items-center gap-3">
          <a href="${basePathToRoot()}index.html" class="flex items-center gap-2.5 min-w-0 flex-shrink-0">
            <img src="${logoUrl()}" alt="Smart Fix & Recycle" class="brand-mark-nav" width="64" height="64" loading="lazy" />
            <span class="font-semibold text-sm text-slate-900 whitespace-nowrap">Smart Fix &amp; Recycle</span>
            <span class="hidden sm:block w-px h-4 bg-slate-900/10"></span>
            <span class="hidden sm:block text-xs text-slate-500 whitespace-nowrap">Uganda</span>
          </a>

          <div class="hidden md:flex flex-1 min-w-0 items-center justify-end gap-4">
            <div class="flex items-center gap-6 flex-wrap justify-end">
              ${link(`${basePathToRoot()}index.html`, "Home", "home")}
              ${link(`${basePathToRoot()}support.html`, "Support", "support")}
              ${link(`${basePathToRoot()}recycle.html`, "Recycle", "recycle")}
              ${link(`${basePathToRoot()}library.html`, "Library", "library")}
              ${link(`${basePathToRoot()}safety.html`, "Safety", "safety")}
              ${link(`${basePathToRoot()}impact.html`, "Impact", "impact")}
              ${link(`${basePathToRoot()}about.html`, "About", "about")}
            </div>
            <div class="flex flex-shrink-0 items-center" id="authNavSlot"></div>
          </div>

          <button type="button" data-sfr-mobile-toggle class="md:hidden ml-auto text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 shadow-sm transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
        </div>
        <div id="sfrMobileMenu" class="hidden md:hidden mt-3 mx-3 sm:mx-4 rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 shadow-sm" style="backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);">
          <div class="flex flex-col gap-2 text-base text-slate-700">
            ${mobileLink(`${basePathToRoot()}index.html`, "Home", "home")}
            ${mobileLink(`${basePathToRoot()}support.html`, "Support", "support")}
            ${mobileLink(`${basePathToRoot()}recycle.html`, "Recycle", "recycle")}
            ${mobileLink(`${basePathToRoot()}library.html`, "Library", "library")}
            ${mobileLink(`${basePathToRoot()}safety.html`, "Safety", "safety")}
            ${mobileLink(`${basePathToRoot()}impact.html`, "Impact", "impact")}
            ${mobileLink(`${basePathToRoot()}about.html`, "About", "about")}
            <div class="pt-2 border-t border-slate-200/70" id="authNavSlotMobile"></div>
          </div>
        </div>
      </nav>
    `;

    const toggle = slot.querySelector("[data-sfr-mobile-toggle]");
    const menu = slot.querySelector("#sfrMobileMenu");
    toggle?.addEventListener("click", () => menu?.classList.toggle("hidden"));

    // Mount auth UI into both slots (desktop + mobile).
    mountNavbar("authNavSlot");
    mountNavbar("authNavSlotMobile");
  }

  window.SFRAuth = {
    mountNavbar,
    mountSiteNavbar,
    requireAuth,
    logout,
    handleRegister,
    handleConfirm,
    handleResendVerification,
    handleLogin,
    handleForgot,
    getSession,
    refreshMeIntoSession,
    openAuthModal,
    apiCreateSupport,
    apiCreatePickup,
    setAlert,
    hideAlert,
  };

  document.addEventListener("DOMContentLoaded", () => {
    autoProtect();
  });
})();

