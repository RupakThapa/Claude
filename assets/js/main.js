/* [BRAND] site script. Loaded with defer. Every feature here is an enhancement:
   the pages read and navigate fine without it. */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var desktop = window.matchMedia("(min-width: 1024px)");

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");

  function setMenu(open, returnFocus) {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
    if (!open && returnFocus) toggle.focus();
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a") && !desktop.matches) setMenu(false);
    });
    var onChange = function () { if (desktop.matches) setMenu(false); };
    if (desktop.addEventListener) desktop.addEventListener("change", onChange);
    else if (desktop.addListener) desktop.addListener(onChange);
  }

  /* ---------- Solutions dropdown (disclosure pattern) ---------- */
  var subItems = Array.prototype.slice.call(document.querySelectorAll(".has-sub"));

  function setSub(item, open) {
    var btn = item.querySelector(".sub-toggle");
    item.classList.toggle("is-open", open);
    if (btn) btn.setAttribute("aria-expanded", String(open));
  }

  subItems.forEach(function (item) {
    var btn = item.querySelector(".sub-toggle");
    if (!btn) return;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setSub(item, !item.classList.contains("is-open"));
    });
    item.addEventListener("focusout", function (e) {
      if (desktop.matches && e.relatedTarget && !item.contains(e.relatedTarget)) setSub(item, false);
    });
  });

  document.addEventListener("click", function (e) {
    subItems.forEach(function (item) {
      if (desktop.matches && !item.contains(e.target)) setSub(item, false);
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var openSub = subItems.filter(function (i) { return i.classList.contains("is-open"); })[0];
    if (openSub) {
      setSub(openSub, false);
      var b = openSub.querySelector(".sub-toggle");
      if (b) b.focus();
      return;
    }
    if (nav && nav.classList.contains("is-open")) setMenu(false, true);
  });

  /* ---------- Eligibility record: one verifier "pass" when it comes into view ---------- */
  var records = document.querySelectorAll(".record");
  if (records.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-live");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.35 });
    Array.prototype.forEach.call(records, function (r) { io.observe(r); });
  }

  /* ---------- Contact form validation ---------- */
  var form = document.querySelector("form[data-validate]");
  if (!form) return;

  form.setAttribute("novalidate", "");
  var status = form.querySelector(".form-status");
  var messages = {
    valueMissing: "This field is required.",
    typeMismatch: "Please enter a valid email address.",
    patternMismatch: "Please check the format.",
    tooShort: "Please add a little more detail."
  };

  function errorFor(field) {
    var v = field.validity;
    if (v.valid) return "";
    if (field.dataset.msg) return field.dataset.msg;
    for (var k in messages) { if (v[k]) return messages[k]; }
    return "Please check this field.";
  }

  function showError(field) {
    var slot = document.getElementById(field.id + "-error");
    var msg = errorFor(field);
    field.setAttribute("aria-invalid", msg ? "true" : "false");
    if (slot) slot.textContent = msg;
    return !msg;
  }

  var fields = Array.prototype.slice.call(form.querySelectorAll("input:not(.hp input), select, textarea"))
    .filter(function (f) { return f.id && f.type !== "hidden" && !f.closest(".hp"); });

  fields.forEach(function (f) {
    f.addEventListener("blur", function () { if (f.value) showError(f); });
    f.addEventListener("input", function () { if (f.getAttribute("aria-invalid") === "true") showError(f); });
  });

  function say(text, isError) {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle("is-error", !!isError);
  }

  form.addEventListener("submit", function (e) {
    var firstBad = null;
    fields.forEach(function (f) { if (!showError(f) && !firstBad) firstBad = f; });
    if (firstBad) {
      e.preventDefault();
      say("Please fix the highlighted fields and send again.", true);
      firstBad.focus();
      return;
    }

    // Spam trap: a filled honeypot gets a quiet "thanks" and nothing is sent.
    var trap = form.querySelector(".hp input");
    if (trap && trap.value) {
      e.preventDefault();
      form.reset();
      say("Thanks. We'll be in touch within one business day.");
      return;
    }

    var action = form.getAttribute("action") || "";
    if (action.indexOf("[") !== -1) {
      e.preventDefault();
      say("The form endpoint hasn't been set up yet. Please email or call us using the details on this page.", true);
      return;
    }

    if (!window.fetch || !window.FormData) return; // fall back to a normal post

    e.preventDefault();
    var button = form.querySelector("[type=submit]");
    if (button) button.disabled = true;
    say("Sending…");

    fetch(action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        form.reset();
        fields.forEach(function (f) { f.removeAttribute("aria-invalid"); });
        say("Thanks. We'll be in touch within one business day to set a time.");
      })
      .catch(function () {
        say("Something went wrong sending the form. Please email or call us instead.", true);
      })
      .then(function () { if (button) button.disabled = false; });
  });
})();
