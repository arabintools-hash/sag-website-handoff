/* Study Abroad Gate — hero eligibility widget (shared, vanilla JS)
   4-step lead capture: destination → level → field + grades →
   instant university matches + suggested programs → WhatsApp capture.
   Drop the matching .qz-* markup on any page and load this with `defer`.
   Reads optional window.SAGForms for validation/tracking if present. */
(function () {
  function init() {
    var form = document.getElementById('consult');
    if (!form || form.dataset.qzInit) return;
    form.dataset.qzInit = '1';

    var UNI = {
      'the UK':    [['University of Manchester','QS #35'],['University of Glasgow','QS #78'],['University of Birmingham','QS #80']],
      'the USA':   [['Arizona State University','Top 1% US'],['University of Illinois','QS #69'],['Purdue University','QS #89']],
      'Canada':    [['University of Toronto','QS #21'],['McGill University','QS #27'],['Univ. of British Columbia','QS #38']],
      'Australia': [['University of Sydney','QS #18'],['UNSW Sydney','QS #19'],['Monash University','QS #37']],
      'Europe':    [['Trinity College Dublin','QS #87'],['Technical Univ. of Munich','QS #28'],['University College Dublin','QS #126']],
      'your profile':[['University of Manchester','QS #35'],['University of Toronto','QS #21'],['Monash University','QS #37']]
    };
    var BASE = { 'the UK':16,'the USA':21,'Canada':14,'Australia':12,'Europe':18,'your profile':22 };
    var TAGS = ['Strong match','Good match','Possible'];

    /* Suggested programs (specializations) by field of interest. */
    var PROGS = {
      'Business':          ['Management','Finance & Investment','International Business'],
      'Computing & Data':  ['Data Science','Computer Science','Artificial Intelligence'],
      'Engineering':       ['Mechanical Engineering','Civil Engineering','Electrical Engineering'],
      'Health & Medicine': ['Public Health','Nursing','Biomedical Science'],
      'Law':               ['International Law','Commercial Law','Human Rights Law'],
      'Arts & Humanities': ['International Relations','Education','Media & Communications'],
      'Not sure':          ['Business Management','Data Science','International Foundation'],
      'default':           ['Business Management','Data Science','Engineering']
    };
    var LVL_SHORT = { "Foundation / English":'Found.', "Bachelor's":'BSc/BA', "Master's":'MSc/MA', 'PhD':'PhD' };

    var state = { destKey:null, destLabel:null, level:null, field:'Business', grades:'3' };

    var STEPS = 4;
    var panels = form.querySelectorAll('.qz-panel');
    var dots = form.querySelectorAll('.qz-prog i');
    var stepLbl = form.querySelector('#qzStepLbl');
    function show(n) {
      panels.forEach(function (p) { p.classList.toggle('active', +p.dataset.step === n); });
      dots.forEach(function (d, i) { d.classList.toggle('on', i < Math.min(n, STEPS)); });
      if (n < STEPS) stepLbl.textContent = 'Step ' + n + ' of ' + STEPS;
      else if (n === STEPS) stepLbl.textContent = 'Step ' + STEPS + ' of ' + STEPS + ' · results';
      else stepLbl.textContent = 'Done';
    }
    function markSel(container, btn) {
      var c = typeof container === 'string' ? form.querySelector(container) : container;
      if (c) c.querySelectorAll('.qz-opt').forEach(function (o) { o.classList.remove('sel'); });
      btn.classList.add('sel');
    }

    var started = false;
    /* STEP 1 — destination (country) */
    form.querySelectorAll('[data-dest]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!started) { started = true; if (window.SAGForms) window.SAGForms.track('form_started', { form: 'hero-eligibility' }); }
        state.destKey = btn.dataset.key; state.destLabel = btn.dataset.dest;
        markSel('#qzDestOpts', btn);
        show(2);
      });
    });

    /* STEP 2 — level */
    form.querySelectorAll('#qzLevel .qz-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.level = btn.dataset.level;
        markSel('#qzLevel', btn);
        show(3);
      });
    });

    /* STEP 3 — field of interest + grades */
    var fieldEl = form.querySelector('#qzField');
    if (fieldEl) { state.field = fieldEl.value; fieldEl.addEventListener('change', function (e) { state.field = e.target.value; }); }
    form.querySelector('#qzGrades').addEventListener('change', function (e) { state.grades = e.target.value; });

    form.querySelector('#qzSee').addEventListener('click', function () {
      var key = state.destKey || 'your profile';
      var unis = UNI[key] || UNI['your profile'];
      var n = (BASE[key] || 16) + (+state.grades);
      form.querySelector('#qzCount').textContent = n;
      form.querySelector('#qzDest').textContent = 'in ' + (state.destLabel || 'your profile');
      var sch = Math.max(2, Math.round(n / 5));
      form.querySelector('#qzSchol').textContent = sch + ' offer scholarships you may qualify for.';

      var list = form.querySelector('#qzList');
      list.innerHTML = '';
      unis.forEach(function (u, i) {
        var tag = TAGS[i] || 'Possible';
        list.insertAdjacentHTML('beforeend',
          '<div class="qz-match"><span class="lg"></span><span style="flex:1;"><b>' + u[0] + '</b><span class="mt">' + u[1] + '</span></span><span class="tag">' + tag + '</span></div>');
      });

      var progsEl = form.querySelector('#qzProgs');
      if (progsEl) {
        var progs = PROGS[state.field] || PROGS['default'];
        var lvl = LVL_SHORT[state.level] || 'MSc/MA';
        progsEl.innerHTML = '';
        progs.forEach(function (p, i) {
          var uni = (unis[i] || unis[0])[0];
          progsEl.insertAdjacentHTML('beforeend',
            '<div class="qz-prog-item"><span class="badge">' + lvl + '</span><span style="flex:1;"><b>' + p + '</b><span class="lvl">' + uni + ' · Sept 2026 intake</span></span></div>');
        });
      }
      show(4);
    });

    /* back buttons */
    form.querySelectorAll('.qz-back').forEach(function (b) {
      b.addEventListener('click', function () { show(+b.dataset.to); });
    });

    /* STEP 4 — capture */
    var sendBtn = form.querySelector('#qzSend');
    var phone = form.querySelector('#qzPhone');
    sendBtn.addEventListener('click', function () {
      if (window.SAGForms) {
        if (!window.SAGForms.validate(phone)) { phone.focus(); return; }
      } else {
        var digits = (phone.value || '').replace(/\D/g, '');
        if (digits.length < 6) { phone.classList.add('qz-err'); phone.focus(); return; }
        phone.classList.remove('qz-err');
      }
      if (window.SAGForms) window.SAGForms.track('form_completed', { form: 'hero-eligibility' });
      show(5);
    });
    phone.addEventListener('input', function () { this.classList.remove('qz-err'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
