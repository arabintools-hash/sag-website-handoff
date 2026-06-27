/* ============================================================================
   Study Abroad Gate — Unified Analytics, Tracking & CRM Layer  (analytics.js)
   ----------------------------------------------------------------------------
   Vanilla JS, no dependencies. One file, installed on every page (EN + AR).
   Privacy-first (Consent Mode v2, GDPR/PDPL aware). No duplicate events.
   Single dispatcher → GTM dataLayer + GA4 (gtag) + Meta Pixel (fbq) + CRM.

   Public API:  window.SAGAnalytics
     .track(name, params)                 unified event dispatch (deduped)
     .destinationSelected(d, extra)       funnel helpers …
     .programSelected(p, extra)
     .universityViewed(u, extra)
     .formStarted(form) / .formCompleted(form)
     .qualificationCompleted({score,matches,scholarships,destination,level})
     .consultationBooked(extra) / .applicationStarted(extra)
     .whatsappClick(ctx)                  (also auto-captured via delegation)
     .lead.build(partial) / .lead.submit(partial) / .lead.advance(id, stage)
     .consent.grant(cats) / .consent.deny() / .consent.status()
     .setContext(obj)                     attach destination/program/etc.
     .config                              live config (placeholders below)

   Replace the three placeholders with real IDs (or inject per-environment):
     GTM-XXXXXXX   ·   G-XXXXXXXXXX   ·   PIXEL_ID
   ========================================================================== */
(function () {
  "use strict";
  if (window.SAGAnalytics) return; // singleton

  /* ---------------------------------------------------------------- config */
  var CONFIG = {
    GTM_ID:        "GTM-XXXXXXX",     // Google Tag Manager container
    GA4_ID:        "G-XXXXXXXXXX",    // GA4 measurement ID
    META_PIXEL_ID: "PIXEL_ID",        // Meta (Facebook) Pixel ID
    CRM_ENDPOINT:  "",                // POST unified lead object here (e.g. /api/crm/lead)

    // Where GA4 + Pixel events are dispatched from:
    //   "direct" → this file calls gtag()/fbq() itself (works with no GTM config)
    //   "gtm"    → only push to dataLayer; GA4/Pixel tags fire INSIDE GTM
    // "direct" is the default so the funnel works out of the box. To switch to
    // GTM-managed tags, set "gtm" and DO NOT also configure direct dispatch —
    // that is how we guarantee one event = one hit (no duplicates).
    dispatch:      "direct",

    requireConsent: true,             // privacy-first: hold marketing until granted
    consentCookie:  "sag_consent",
    idKey:          "sag_id",
    attributionKey: "sag_attribution",
    sessionKey:     "sag_session",
    sessionMins:    30,
    scrollThresholds: [25, 50, 75, 90, 100],
    debug:          /[?&]sag_debug=1/.test(location.search)
  };

  /* --------------------------------------------------------------- helpers */
  function log() { if (CONFIG.debug && window.console) console.info.apply(console, ["[SAGAnalytics]"].concat([].slice.call(arguments))); }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8; return v.toString(16);
    });
  }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function getLanguage() {
    var htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    if (htmlLang.indexOf("ar") === 0) return "ar";
    if (/(^|\/)ar(\/|$)/.test(location.pathname)) return "ar";
    return "en";
  }
  function getPageType() {
    var p = location.pathname.toLowerCase();
    if (/university/.test(p)) return "university";
    if (/destination/.test(p)) return "destination";
    if (/program/.test(p)) return "program";
    if (/contact/.test(p)) return "contact";
    if (/(index\.html)?$/.test(p) && /(\/ar\/?$|\/$|homepage|index)/.test(p)) return "home";
    return "home";
  }
  function getDeviceType() {
    var w = window.innerWidth || document.documentElement.clientWidth;
    var ua = navigator.userAgent || "";
    if (/Mobi|Android|iPhone/i.test(ua) || w < 680) return "mobile";
    if (/iPad|Tablet/i.test(ua) || w < 1080) return "tablet";
    return "desktop";
  }

  /* ----------------------------------------------- first-party identity */
  function getId() {
    var id = lsGet(CONFIG.idKey);
    if (!id) { id = "sag_" + uuid(); lsSet(CONFIG.idKey, id); }
    return id;
  }
  function getSession() {
    var now = Date.now(), s = null;
    try { s = JSON.parse(sessionStorage.getItem(CONFIG.sessionKey)); } catch (e) {}
    var fresh = !s || (now - s.last) > CONFIG.sessionMins * 60000;
    if (fresh) s = { id: "ses_" + uuid(), start: now, last: now, isNew: true };
    else { s.isNew = false; s.last = now; }
    try { sessionStorage.setItem(CONFIG.sessionKey, JSON.stringify(s)); } catch (e) {}
    return s;
  }

  /* ------------------------------- cross-language first-touch attribution */
  function captureAttribution() {
    var existing = lsGet(CONFIG.attributionKey);
    if (existing) return existing; // first-touch wins — preserved across EN/AR
    var q = new URLSearchParams(location.search);
    var attr = {
      utm_source:   q.get("utm_source") || "",
      utm_medium:   q.get("utm_medium") || "",
      utm_campaign: q.get("utm_campaign") || "",
      utm_term:     q.get("utm_term") || "",
      utm_content:  q.get("utm_content") || "",
      gclid:        q.get("gclid") || "",
      fbclid:       q.get("fbclid") || "",
      referrer:     document.referrer || "",
      landing_page: location.pathname,
      first_language: getLanguage(),
      timestamp:    new Date().toISOString()
    };
    lsSet(CONFIG.attributionKey, attr);
    return attr;
  }

  /* -------------------------------------------------- mutable page context */
  var CONTEXT = {};
  function setContext(obj) { for (var k in obj) if (obj[k] != null) CONTEXT[k] = obj[k]; }

  function baseContext() {
    var ses = getSession();
    return {
      sag_id:      getId(),
      session_id:  ses.id,
      language:    getLanguage(),
      device_type: getDeviceType(),
      page_type:   getPageType(),
      page_path:   location.pathname,
      page_title:  document.title
    };
  }

  /* ------------------------------------------------------------- consent */
  function consentDefaults() {
    // Consent Mode v2 — deny advertising + analytics storage until granted.
    gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      functionality_storage: "granted",
      security_storage: "granted",
      wait_for_update: 500
    });
  }
  var Consent = {
    status: function () { return lsGet(CONFIG.consentCookie) || { analytics: false, marketing: false, set: false }; },
    grant: function (cats) {
      cats = cats || { analytics: true, marketing: true };
      lsSet(CONFIG.consentCookie, { analytics: !!cats.analytics, marketing: !!cats.marketing, set: true, ts: Date.now() });
      gtag("consent", "update", {
        analytics_storage: cats.analytics ? "granted" : "denied",
        ad_storage: cats.marketing ? "granted" : "denied",
        ad_user_data: cats.marketing ? "granted" : "denied",
        ad_personalization: cats.marketing ? "granted" : "denied"
      });
      if (cats.marketing) loadPixel();
      flushQueue();
      dl({ event: "consent_update", consent_analytics: !!cats.analytics, consent_marketing: !!cats.marketing });
      log("consent granted", cats);
    },
    deny: function () {
      lsSet(CONFIG.consentCookie, { analytics: false, marketing: false, set: true, ts: Date.now() });
      gtag("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      log("consent denied");
    }
  };
  function marketingAllowed() { return !CONFIG.requireConsent || Consent.status().marketing; }
  function analyticsAllowed() { return !CONFIG.requireConsent || Consent.status().analytics; }

  /* ----------------------------------------------- vendor bootstrappers */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }       // GA4 uses the dataLayer queue
  function dl(obj) { window.dataLayer.push(obj); }            // GTM semantic push

  function injectGTM() {
    if (!CONFIG.GTM_ID || /XXXX/.test(CONFIG.GTM_ID)) { log("GTM id is a placeholder — script not loaded"); return; }
    if (window.__sagGTM) return; window.__sagGTM = true;
    dl({ "gtm.start": Date.now(), event: "gtm.js" });
    var s = document.createElement("script"); s.async = true;
    s.src = "https://www.googletagmanager.com/gtm.js?id=" + CONFIG.GTM_ID;
    document.head.appendChild(s);
  }
  function injectGA4() {
    if (CONFIG.dispatch !== "direct") return;
    if (!CONFIG.GA4_ID || /XXXX/.test(CONFIG.GA4_ID)) { log("GA4 id is a placeholder — gtag not loaded"); return; }
    if (window.__sagGA4) return; window.__sagGA4 = true;
    var s = document.createElement("script"); s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + CONFIG.GA4_ID;
    document.head.appendChild(s);
    gtag("js", new Date());
    // manual page_view → no duplicate with auto send_page_view
    gtag("config", CONFIG.GA4_ID, { send_page_view: false, anonymize_ip: true });
  }
  var pixelReady = false;
  function loadPixel() {
    if (CONFIG.dispatch !== "direct") return;
    if (!CONFIG.META_PIXEL_ID || /PIXEL_ID/.test(CONFIG.META_PIXEL_ID)) { log("Pixel id is a placeholder — fbq not loaded"); return; }
    if (window.__sagPixel) { pixelReady = true; return; } window.__sagPixel = true;
    /* Meta Pixel base code */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", CONFIG.META_PIXEL_ID);
    pixelReady = true;
    log("pixel initialised");
  }

  /* --------------------------------------------------- event dispatch core */
  // Meta Pixel standard-event mapping (others → trackCustom)
  var PIXEL_MAP = {
    page_view:               "PageView",
    destination_selected:    "ViewContent",
    program_selected:        "ViewContent",
    university_viewed:       "ViewContent",
    form_completed:          "Lead",
    qualification_completed: "Lead",
    whatsapp_click:          "Contact",
    consultation_booked:     "Schedule",
    application_started:     "CompleteRegistration"
  };
  // Events forwarded to GA4/Pixel when pushed RAW to dataLayer by legacy emitters
  // (e.g. ar-forms.js). whatsapp_click is excluded — this file owns it directly.
  var FORWARD = { form_started: 1, form_completed: 1, qualification_completed: 1, validation_error: 1 };

  var seen = {};            // dedupe ledger by event id
  var queue = [];           // events captured before analytics consent

  function toGA4(name, params) {
    if (CONFIG.dispatch !== "direct" || !window.__sagGA4) return;
    var p = {}; for (var k in params) if (params[k] != null && k.charAt(0) !== "_") p[k] = params[k];
    gtag("event", name, p);
  }
  function toPixel(name, params, eid) {
    if (CONFIG.dispatch !== "direct" || !pixelReady || !window.fbq) return;
    if (!marketingAllowed()) return;
    var std = PIXEL_MAP[name];
    var data = {
      content_name: params.page_title || document.title,
      content_category: params.page_type,
      content_ids: [params.destination || params.program || params.university || params.page_type].filter(Boolean)
    };
    if (std) window.fbq("track", std, data, { eventID: eid });
    else window.fbq("trackCustom", name, data, { eventID: eid });
  }

  function dispatch(name, params, opts) {
    opts = opts || {};
    var eid = params._eid || (name + ":" + (params.session_id || "") + ":" + Date.now() + ":" + Math.random().toString(36).slice(2, 7));
    if (seen[eid]) { log("dedup skip", name); return; }
    seen[eid] = 1;

    // 1) GTM dataLayer (always — privacy-safe, no PII)
    var dlEvent = {}; for (var k in params) dlEvent[k] = params[k];
    dlEvent.event = name; dlEvent._eid = eid; dlEvent._sagDispatched = 1;
    dl(dlEvent);

    // 2) GA4 — gated by analytics consent (Consent Mode also enforces server-side)
    if (analyticsAllowed()) toGA4(name, params);
    else if (!opts.fromQueue) { queue.push({ name: name, params: params, eid: eid }); }

    // 3) Meta Pixel — gated by marketing consent
    toPixel(name, params, eid);

    log("event", name, params);
  }
  function flushQueue() {
    if (!analyticsAllowed()) return;
    var q = queue.splice(0); q.forEach(function (e) { toGA4(e.name, e.params); });
  }

  /* unified public track() */
  function track(name, params) {
    params = Object.assign({}, baseContext(), CONTEXT, params || {});
    dispatch(name, params, {});
    return params._eid;
  }

  /* ---------- intercept RAW dataLayer pushes from legacy emitters ---------- */
  function installForwarder() {
    var native = window.dataLayer.push.bind(window.dataLayer);
    window.dataLayer.push = function () {
      var ret = native.apply(window.dataLayer, arguments);
      for (var i = 0; i < arguments.length; i++) {
        var o = arguments[i];
        if (o && typeof o === "object" && o.event && !o._sagDispatched && FORWARD[o.event]) {
          var params = Object.assign({}, baseContext(), CONTEXT, o);
          delete params.event;
          var eid = "fwd:" + o.event + ":" + Date.now() + ":" + Math.random().toString(36).slice(2, 7);
          if (analyticsAllowed()) toGA4(o.event, params); else queue.push({ name: o.event, params: params, eid: eid });
          toPixel(o.event, params, eid);
          log("forwarded legacy", o.event);
          // derive funnel-stage events from a generic form completion (page-aware)
          if (o.event === "form_completed") {
            var pt = getPageType();
            if (pt === "contact") track("consultation_booked", { form_name: o.form || o.form_name || "consultation" });
            else if (pt === "program") track("application_started", { form_name: o.form || o.form_name || "program_apply" });
          }
        }
      }
      return ret;
    };
  }

  /* --------------------------------------------------- funnel helper API */
  function destinationSelected(d, extra) { setContext({ destination: d }); track("destination_selected", Object.assign({ destination: d }, extra)); }
  function programSelected(p, extra)    { setContext({ program: p });     track("program_selected", Object.assign({ program: p }, extra)); }
  function universityViewed(u, extra)   { setContext({ university: u });   track("university_viewed", Object.assign({ university: u }, extra)); }
  function formStarted(form)            { track("form_started", { form_name: form }); }
  function formCompleted(form, extra)   { track("form_completed", Object.assign({ form_name: form }, extra)); }
  function qualificationCompleted(o)    {
    o = o || {};
    track("qualification_completed", {
      qualification_score: o.score, matches: o.matches, scholarships: o.scholarships,
      destination: o.destination, program_level: o.level
    });
  }
  function consultationBooked(extra)    { track("consultation_booked", extra || {}); }
  function applicationStarted(extra)    { track("application_started", extra || {}); }

  function whatsappClick(ctx) { track("whatsapp_click", ctx || {}); }

  /* -------------------------- CRM unified lead object ---------------------- */
  var LEAD_STAGES = ["New", "Qualified", "Consultation", "Application", "Offer", "Visa", "Enrolled"];
  var COUNSELORS = ["Layla", "Omar", "Mariam", "Yousef"]; // round-robin placeholder

  function buildLead(partial) {
    partial = partial || {};
    var attr = captureAttribution();
    var lead = {
      lead_id:             partial.lead_id || ("lead_" + uuid()),
      timestamp:           new Date().toISOString(),
      source_page:         partial.source_page || getPageType(),
      language:            partial.language || getLanguage(),
      destination:         partial.destination || CONTEXT.destination || null,
      program:             partial.program || CONTEXT.program || null,
      university:          partial.university || CONTEXT.university || null,
      country:             partial.country || null,            // phone-derived dialing country
      phone:               partial.phone || null,
      email:               partial.email || null,
      qualification_score: partial.qualification_score != null ? partial.qualification_score : (CONTEXT.qualification_score || null),
      counselor_assigned:  partial.counselor_assigned || COUNSELORS[Math.floor(Math.random() * COUNSELORS.length)],
      lead_stage:          partial.lead_stage || "New",
      // attribution travels with the lead (cross-language safe)
      attribution:         attr,
      sag_id:              getId(),
      session_id:          getSession().id,
      device_type:         getDeviceType()
    };
    return lead;
  }
  function submitLead(partial) {
    var lead = buildLead(partial);
    // dataLayer signal for GTM → CRM/webhook tags
    dl({ event: "crm_lead", _sagDispatched: 1, lead_id: lead.lead_id, lead_stage: lead.lead_stage,
         language: lead.language, destination: lead.destination, qualification_score: lead.qualification_score });
    // direct POST to CRM (PII only travels here, over the secure endpoint)
    if (CONFIG.CRM_ENDPOINT && marketingAllowed()) {
      try {
        fetch(CONFIG.CRM_ENDPOINT, {
          method: "POST", keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lead)
        }).catch(function () {});
      } catch (e) {}
    }
    lsSet("sag_last_lead", { lead_id: lead.lead_id, lead_stage: lead.lead_stage });
    log("lead submit", lead);
    return lead;
  }
  function advanceStage(leadId, stage) {
    if (LEAD_STAGES.indexOf(stage) < 0) { log("unknown stage", stage); return; }
    dl({ event: "crm_stage_change", _sagDispatched: 1, lead_id: leadId, lead_stage: stage, ts: new Date().toISOString() });
    if (CONFIG.CRM_ENDPOINT && marketingAllowed()) {
      try { fetch(CONFIG.CRM_ENDPOINT + "/stage", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_id: leadId, lead_stage: stage }) }).catch(function () {}); } catch (e) {}
    }
    log("stage →", stage, leadId);
  }

  /* ----------------------------------------- automatic instrumentation */
  function autoPageView() {
    var ses = getSession();
    if (ses.isNew) track("session_start", {});
    track("language_select", { language: getLanguage() });
    track("page_view", { referrer: document.referrer || "" });
    // ViewContent equivalents for content pages
    var pt = getPageType();
    if (pt === "university") track("university_viewed", { university: document.title });
    else if (pt === "destination") track("destination_selected", { destination: document.title, interaction: "page_view" });
    else if (pt === "program") track("program_selected", { program: document.title, interaction: "page_view" });
  }

  function autoScroll() {
    var fired = {}, ticking = false;
    function check() {
      ticking = false;
      var h = document.documentElement, b = document.body;
      var st = h.scrollTop || b.scrollTop;
      var sh = (h.scrollHeight || b.scrollHeight) - h.clientHeight;
      var pct = sh > 0 ? Math.min(100, Math.round((st / sh) * 100)) : 100;
      CONFIG.scrollThresholds.forEach(function (t) {
        if (pct >= t && !fired[t]) { fired[t] = 1; track("scroll", { percent_scrolled: t }); }
      });
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
  }

  function ctaLocation(a) {
    if (a.closest(".wa-float")) return "floating_button";
    if (a.closest(".m-cta")) return "mobile_sticky_bar";
    if (a.closest("#parents, [id*='parent']")) return "parent_cta";
    if (a.closest("header, .site-head, .hf-head")) return "header";
    if (a.closest("footer, .site-foot")) return "footer";
    if (a.closest(".hero, .hero-form, #consult")) return "hero";
    if (a.closest("[data-success], .qz-success")) return "post_qualification";
    var sec = a.closest("section[id]");
    return sec ? ("section_" + sec.id) : "inline";
  }
  function autoWhatsApp() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href*="wa.me"], a[href*="whatsapp"], a[href*="api.whatsapp"]');
      if (!a) return;
      whatsappClick({
        source: ctaLocation(a),
        cta_location: ctaLocation(a),
        destination: CONTEXT.destination || null,
        language: getLanguage(),
        device_type: getDeviceType(),
        link_url: a.getAttribute("href") || ""
      });
    }, true); // capture phase — fires before navigation
  }

  function autoLanguageSwitch() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a.lang-toggle, a[href*="/ar/"], a[hreflang]');
      if (!a) return;
      var href = a.getAttribute("href") || "";
      var cur = getLanguage();
      var to = /\/ar\b|ar\/index/.test(href) ? "ar" : (a.getAttribute("hreflang") || (cur === "ar" ? "en" : "ar"));
      if (to === cur) return;
      track("language_switch", { from_language: cur, to_language: to });
    }, true);
  }

  /* SPA hook (React kit uses window.__nav) — fire page_view on route change */
  function hookSPA() {
    if (typeof window.__nav === "function" && !window.__nav.__sagWrapped) {
      var orig = window.__nav;
      var wrapped = function (r) { var ret = orig.apply(this, arguments); setTimeout(autoPageView, 0); return ret; };
      wrapped.__sagWrapped = true; window.__nav = wrapped;
    }
  }

  /* ------------------------------------------------------------- bootstrap */
  function init() {
    captureAttribution();
    consentDefaults();
    injectGTM();
    injectGA4();
    if (marketingAllowed()) loadPixel();
    installForwarder();

    autoPageView();
    autoScroll();
    autoWhatsApp();
    autoLanguageSwitch();
    hookSPA();
    // late SPA routers may attach after load
    window.addEventListener("load", hookSPA);
    log("initialised", { lang: getLanguage(), page: getPageType(), device: getDeviceType() });
  }

  /* ------------------------------------------------------------ public API */
  window.SAGAnalytics = {
    config: CONFIG,
    track: track,
    setContext: setContext,
    destinationSelected: destinationSelected,
    programSelected: programSelected,
    universityViewed: universityViewed,
    formStarted: formStarted,
    formCompleted: formCompleted,
    qualificationCompleted: qualificationCompleted,
    consultationBooked: consultationBooked,
    applicationStarted: applicationStarted,
    whatsappClick: whatsappClick,
    consent: Consent,
    lead: { build: buildLead, submit: submitLead, advance: advanceStage, STAGES: LEAD_STAGES },
    context: function () { return Object.assign(baseContext(), CONTEXT); },
    _internal: { dispatch: dispatch, getId: getId, getSession: getSession }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
