/**
 * Home — "Our Services" cards (clean white cards + SVG icons; edit SFR_HOME_SERVICES).
 */
(function () {
  /** Outline icons (24×24), stroke-based for crisp display */
  var ICONS = {
    support:
      '<svg class="h-6 w-6 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" /></svg>',
    recycle:
      '<svg class="h-6 w-6 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>',
    library:
      '<svg class="h-6 w-6 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v15.341A24.993 24.993 0 0112 18c2.305 0 4.523.457 6.53 1.284V8.512A8.967 8.967 0 0018 6.75c-1.052 0-2.062.18-3 .512zm0 0c2.305 0 4.523.457 6.53 1.284V8.512A8.967 8.967 0 0018 6.75c-1.052 0-2.062.18-3 .512v15.341a24.993 24.993 0 01-6.53 1.284z" /></svg>',
    safety:
      '<svg class="h-6 w-6 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>',
  };

  var SFR_HOME_SERVICES = [
    {
      iconKey: "support",
      iconWrap: "bg-sky-50 text-sky-600 ring-1 ring-sky-100",
      title: "Remote IT Support",
      description:
        "Submit a triage ticket for laptops, phones, or software. Our engineers help you diagnose and fix issues remotely — reducing clinic congestion and wait times.",
      href: "support.html",
      cta: "Get help",
    },
    {
      iconKey: "recycle",
      iconWrap: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
      title: "E-Waste Pickup & Recycling",
      description:
        "Book a pickup for old phones, PCs, batteries, and cables. We route material toward responsible recycling aligned with Uganda’s e-waste goals.",
      href: "recycle.html",
      cta: "Schedule pickup",
    },
    {
      iconKey: "library",
      iconWrap: "bg-violet-50 text-violet-600 ring-1 ring-violet-100",
      title: "Self-Help Library",
      description:
        "Step-by-step guides for Tecno, Infinix, Samsung, and common Android issues — written for everyday users across Uganda.",
      href: "library.html",
      cta: "Browse guides",
    },
    {
      iconKey: "safety",
      iconWrap: "bg-amber-50 text-amber-600 ring-1 ring-amber-100",
      title: "Data Safety Before Disposal",
      description:
        "Learn how to back up, sign out, and wipe storage before you hand in a device — so your photos and accounts stay private.",
      href: "safety.html",
      cta: "Read article",
    },
  ];

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function iconBlock(item) {
    var svg = ICONS[item.iconKey] || "";
    return (
      '<div class="mb-5 flex h-12 w-12 items-center justify-center rounded-xl ' +
      item.iconWrap +
      '">' +
      svg +
      "</div>"
    );
  }

  function render() {
    var root = document.getElementById("home-services-root");
    if (!root) return;

    var html = SFR_HOME_SERVICES.map(function (item) {
      return (
        '<a href="' +
        esc(item.href) +
        '" class="service-card group flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300/70 hover:shadow-[0_12px_40px_-12px_rgba(15,23,42,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">' +
        iconBlock(item) +
        '<h3 class="mb-2 text-lg font-semibold tracking-tight text-slate-900">' +
        esc(item.title) +
        "</h3>" +
        '<p class="flex-1 text-sm leading-relaxed text-slate-600">' +
        esc(item.description) +
        "</p>" +
        '<div class="mt-5 flex items-center text-sm font-semibold text-orange-600">' +
        '<span>' +
        esc(item.cta) +
        '</span>' +
        '<svg class="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>' +
        "</div>" +
        "</a>"
      );
    }).join("");

    root.innerHTML = html;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
