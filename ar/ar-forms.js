/* ============================================================
   Study Abroad Gate — Arabic forms & validation engine
   Vanilla JS, no dependencies. Auto-enhances any markup that
   opts in via data-attributes. Load with `defer` on /ar/ pages.

   Opt-in:
     <form data-sag-form id="...">  OR  <div data-sag-form>
     <input data-validate="required email">
     <input type="tel" data-phone data-validate="required phone">
     <select name="gpa" data-validate="gpa">       (soft warning)
     [data-reveal-when="level=الماجستير"]            (progressive disclosure)
     [data-qualify-output]                            (instant feedback)
     [data-submit]                                    (validate trigger)
     [data-success]                                   (shown after success)

   Analytics: window.dataLayer + console.info
     form_started · form_completed · validation_error · whatsapp_click
   ============================================================ */
(function () {
  "use strict";

  /* ---------- analytics ---------- */
  window.dataLayer = window.dataLayer || [];
  function track(event, data) {
    var payload = Object.assign({ event: event, ts: Date.now() }, data || {});
    try { window.dataLayer.push(payload); } catch (e) {}
    if (window.console && console.info) console.info("[analytics]", event, data || {});
  }
  window.sagTrack = track;
  /* ---------- GCC + Egypt dialing data ---------- */
  var COUNTRIES = [
    { c: "SA", d: "+966", f: "🇸🇦", n: 9 },
    { c: "AE", d: "+971", f: "🇦🇪", n: 9 },
    { c: "KW", d: "+965", f: "🇰🇼", n: 8 },
    { c: "QA", d: "+974", f: "🇶🇦", n: 8 },
    { c: "BH", d: "+973", f: "🇧🇭", n: 8 },
    { c: "OM", d: "+968", f: "🇴🇲", n: 8 },
    { c: "EG", d: "+20",  f: "🇪🇬", n: 10 }
  ];
  function ccByDial(d) { for (var i = 0; i < COUNTRIES.length; i++) if (COUNTRIES[i].d === d) return COUNTRIES[i]; return COUNTRIES[0]; }

  /* ---------- Arabic messages ---------- */
  var MSG = {
    required: "يرجى تعبئة هذا الحقل",
    email: "يرجى إدخال بريد إلكتروني صحيح",
    phone: "يرجى إدخال رقم واتساب صحيح",
    gpa: "قد تتطلب بعض الجامعات معدلاً أعلى"
  };

  /* ---------- helpers ---------- */
  function fieldOf(el) { return el.closest(".field") || el.parentNode; }
  function rules(el) { return (el.getAttribute("data-validate") || "").split(/\s+/).filter(Boolean); }
  function val(el) { return (el.value || "").trim(); }
  var uid = 0;

  function ensureMsg(field, cls, icon) {
    var e = field.querySelector("." + cls);
    if (!e) {
      e = document.createElement("div");
      e.className = cls;
      e.innerHTML = '<span aria-hidden="true">' + icon + "</span><span class=\"msg\"></span>";
      field.appendChild(e);
    }
    return e;
  }

  function showError(input, msg) {
    var field = fieldOf(input);
    field.classList.add("invalid");
    var e = ensureMsg(field, "field-error", "⚠");
    e.querySelector(".msg").textContent = msg;
    e.setAttribute("role", "alert");
    if (!e.id) e.id = "ferr-" + (++uid);
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", e.id);
    track("validation_error", { field: input.name || input.id || input.type, message: msg });
  }
  function clearError(input) {
    var field = fieldOf(input);
    field.classList.remove("invalid");
    input.setAttribute("aria-invalid", "false");
    var e = field.querySelector(".field-error");
    if (e) e.removeAttribute("role");
  }
  function showWarn(input, msg) {
    var f = fieldOf(input);
    f.classList.add("warn");
    ensureMsg(f, "field-warn", "ℹ").querySelector(".msg").textContent = msg;
  }
  function clearWarn(input) { fieldOf(input).classList.remove("warn"); }

  /* ---------- validation ---------- */
  function isPhone(input) { return input.hasAttribute("data-phone"); }

  function validateField(input) {
    var rs = rules(input);

    if (isPhone(input)) {
      var grp = input.closest(".phone-group");
      var sel = grp ? grp.querySelector(".ccsel") : null;
      var need = sel ? ccByDial(sel.value).n : 8;
      var digits = val(input).replace(/\D/g, "");
      if (rs.indexOf("required") >= 0 && !digits) { showError(input, MSG.required); return false; }
      if (digits && (digits.length < need - 1 || digits.length > need + 1)) { showError(input, MSG.phone); return false; }
      clearError(input); return true;
    }

    if (rs.indexOf("required") >= 0) {
      if (input.type === "checkbox") { if (!input.checked) { showError(input, MSG.required); return false; } }
      else if (!val(input)) { showError(input, MSG.required); return false; }
    }
    if (rs.indexOf("email") >= 0 && val(input)) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val(input))) { showError(input, MSG.email); return false; }
    }
    clearError(input);
    return true; /* gpa is a soft, non-blocking warning */
  }

  function handleGpa(sel) {
    var g = parseFloat(sel.value);
    if (!isNaN(g) && g <= 1) showWarn(sel, MSG.gpa); else clearWarn(sel);
  }

  /* ---------- GCC phone enhancement ---------- */
  function enhancePhone(input) {
    if (input.dataset.phoneReady) return;
    input.dataset.phoneReady = "1";

    var group = document.createElement("div");
    group.className = "phone-group";
    var sel = document.createElement("select");
    sel.className = "ccsel";
    sel.setAttribute("aria-label", "رمز الدولة");
    COUNTRIES.forEach(function (g) {
      var o = document.createElement("option");
      o.value = g.d; o.textContent = g.f + " " + g.d;
      sel.appendChild(o);
    });
    sel.value = "+966"; /* default: Saudi Arabia */

    input.parentNode.insertBefore(group, input);
    group.appendChild(sel);
    group.appendChild(input);

    input.setAttribute("inputmode", "tel");
    input.setAttribute("dir", "ltr");
    input.setAttribute("autocomplete", "tel-national");

    function format() {
      var max = ccByDial(sel.value).n + 1;
      var d = input.value.replace(/\D/g, "").slice(0, max);
      input.value = d.replace(/(\d{3})(?=\d)/g, "$1 ").trim(); /* light auto-formatting */
    }
    input.addEventListener("input", format);
    sel.addEventListener("change", function () { format(); if (input.value) validateField(input); });
  }

  /* ---------- conversion: save + restore form state ---------- */
  function persist(form) {
    var key = "sagform:" + (form.id || location.pathname);
    try {
      var saved = JSON.parse(localStorage.getItem(key) || "{}");
      form.querySelectorAll("[name]").forEach(function (el) {
        if (saved[el.name] == null) return;
        if (el.type === "checkbox") el.checked = !!saved[el.name];
        else el.value = saved[el.name];
      });
    } catch (e) {}
    form.addEventListener("input", function () {
      var data = {};
      form.querySelectorAll("[name]").forEach(function (el) {
        data[el.name] = el.type === "checkbox" ? el.checked : el.value;
      });
      try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
    });
    form._sagKey = key;
  }

  /* ---------- conversion: progressive disclosure ---------- */
  function setupReveal(form) {
    var targets = form.querySelectorAll("[data-reveal-when]");
    if (!targets.length) return;
    function apply() {
      targets.forEach(function (t) {
        var cond = (t.getAttribute("data-reveal-when") || "").split("=");
        var f = form.querySelector('[name="' + cond[0] + '"]');
        var show = f && (f.value === cond[1] || (cond[1] === "*" && !!f.value));
        t.style.display = show ? "" : "none";
        t.querySelectorAll("[data-validate]").forEach(function (i) { i.disabled = !show; });
      });
    }
    form.addEventListener("change", apply);
    apply();
  }

  /* ---------- conversion: instant qualification feedback ---------- */
  function setupQualify(form) {
    var box = form.querySelector("[data-qualify-output]");
    if (!box) return;
    function compute() {
      var lvl = form.querySelector("[name=level]");
      var gpa = form.querySelector("[name=gpa]");
      if (!gpa || gpa.value === "") return;
      var g = parseFloat(gpa.value);
      if (g >= 2) { box.className = "qual-feedback good show"; box.innerHTML = '<span aria-hidden="true">✓</span> <span>ملفك واعد — لديك فرص قوية للقبول والحصول على منحة.</span>'; }
      else if (g >= 1) { box.className = "qual-feedback good show"; box.innerHTML = '<span aria-hidden="true">✓</span> <span>فرصك جيدة — سنرشّح لك جامعات مناسبة تماماً لمعدّلك.</span>'; }
      else { box.className = "qual-feedback warn show"; box.innerHTML = '<span aria-hidden="true">ℹ</span> <span>لا تقلق — سنبحث لك عن مسارات مرنة وجامعات تقبل معدّلك الحالي.</span>'; }
      box.setAttribute("role", "status");
    }
    form.addEventListener("change", compute);
  }

  /* ---------- success ---------- */
  function showSuccess(form) {
    var panel = form.querySelector("[data-success]");
    if (panel) {
      Array.prototype.forEach.call(form.children, function (ch) { if (ch !== panel) ch.style.display = "none"; });
      panel.style.display = "block";
      panel.setAttribute("role", "status");
      panel.focus && panel.focus();
    }
    if (form._sagKey) { try { localStorage.removeItem(form._sagKey); } catch (e) {} }
  }

  /* ---------- wiring ---------- */
  function wire(form) {
    var started = false;
    form.addEventListener("focusin", function () {
      if (!started) { started = true; track("form_started", { form: form.id || "" }); }
    });

    form.querySelectorAll("[data-validate]").forEach(function (input) {
      var rs = rules(input);
      input.addEventListener("blur", function () { if (!input.disabled) validateField(input); });
      input.addEventListener("input", function () { if (fieldOf(input).classList.contains("invalid")) validateField(input); });
      if (rs.indexOf("gpa") >= 0) input.addEventListener("change", function () { handleGpa(input); });
    });

    function submit(e) {
      var ok = true, first = null;
      form.querySelectorAll("[data-validate]").forEach(function (input) {
        if (input.disabled) return;
        if (!validateField(input)) { ok = false; if (!first) first = input; }
      });
      if (!ok) { if (e) e.preventDefault(); if (first) first.focus(); return false; }
      track("form_completed", { form: form.id || "" });
      return true;
    }

    if (form.tagName === "FORM") {
      form.addEventListener("submit", function (e) { if (submit(e)) { e.preventDefault(); showSuccess(form); } });
    }
    form.querySelectorAll("[data-submit]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        if (submit(e)) showSuccess(form);
      });
    });
  }

  /* ---------- whatsapp click tracking (global) ---------- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href*="wa.me"], a[href*="whatsapp"]');
    if (a) track("whatsapp_click", { href: a.getAttribute("href") || "" });
  });

  /* ---------- public API (for bespoke widgets, e.g. the homepage quiz) ---------- */
  window.SAGForms = { validate: validateField, enhancePhone: enhancePhone, track: track };

  /* ---------- init ---------- */
  function init() {
    document.querySelectorAll('input[type="tel"][data-phone]').forEach(enhancePhone);
    document.querySelectorAll('input[type="email"], input[type="url"], input[type="number"]').forEach(function (i) { i.setAttribute("dir", "ltr"); });
    document.querySelectorAll("form[data-sag-form], [data-sag-form]").forEach(function (f) {
      wire(f); persist(f); setupReveal(f); setupQualify(f);
    });
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
