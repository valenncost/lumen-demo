/* =========================================================================
   LUMEN · WEB DEL CONSULTORIO
   Arma las secciones a partir de config.js y maneja menú, filtros,
   preguntas, galería, WhatsApp y animaciones.
   ========================================================================= */
(function () {
  "use strict";
  const { config: C, store: S, util: U } = window.Lumen;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const icon = window.LumenIcon;
  const use = (id) => `<svg><use href="#${id}"/></svg>`;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Textos desde config.js ---------- */
  const get = (path) => path.split(".").reduce((o, k) => (o ? o[k] : undefined), C);
  $$("[data-cfg]").forEach((el) => { el.textContent = get(el.dataset.cfg) || ""; });
  $$("[data-cfg-list]").forEach((el) => { el.innerHTML = (get(el.dataset.cfgList) || []).map((t) => `<span>${U.esc(t)}</span>`).join(""); });
  const ig = $("#igLink");
  if (ig) { ig.href = "https://instagram.com/" + C.consultorio.instagram; ig.textContent = "@" + C.consultorio.instagram; }
  $("#mapFrame").src = "https://www.google.com/maps?q=" + encodeURIComponent(C.consultorio.mapa) + "&z=13&output=embed";

  /* ---------- WhatsApp ---------- */
  const waNum = () => S.ajustes().whatsapp;
  const waTexto = "Hola Lumen! Quería hacer una consulta 🙂";
  function wireWA() {
    $$("[data-wa]").forEach((a) => { a.href = U.waLink(waNum(), a.dataset.waText || waTexto); a.target = "_blank"; a.rel = "noopener"; });
  }
  wireWA();

  /* ---------- Barra demo ---------- */
  const bar = $("#demoBar");
  let barCerrada = false;
  try { barCerrada = sessionStorage.getItem("lumen.demoBar") === "0"; } catch (e) {}
  const cerrarBarra = () => { bar.remove(); document.body.classList.remove("has-demo-bar"); };
  if (barCerrada) cerrarBarra();
  $("#demoBarClose").addEventListener("click", () => {
    try { sessionStorage.setItem("lumen.demoBar", "0"); } catch (e) {}
    cerrarBarra();
  });

  /* ---------- Navbar y menú celu ---------- */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 10);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const burger = $("#burger");
  const menu = $("#mobileMenu");
  function toggleMenu(open) {
    const v = open != null ? open : !document.body.classList.contains("menu-open");
    document.body.classList.toggle("menu-open", v);
    burger.setAttribute("aria-expanded", String(v));
    burger.setAttribute("aria-label", v ? "Cerrar menú" : "Abrir menú");
    menu.setAttribute("aria-hidden", String(!v));
  }
  burger.addEventListener("click", () => toggleMenu());
  menu.addEventListener("click", (e) => { if (e.target.closest("a, button")) toggleMenu(false); });
  window.addEventListener("resize", () => { if (window.innerWidth >= 960) toggleMenu(false); });

  /* ---------- Soluciones ---------- */
  $("#solGrid").innerHTML = C.soluciones.map((s) => `
    <article class="sol-card reveal">
      <div class="sol-photo"><img src="${U.esc(s.foto)}" alt="" loading="lazy" width="1600" height="1067"></div>
      <div class="sol-body">
        <h3>${U.esc(s.titulo)}</h3>
        <p>${U.esc(s.texto)}</p>
        <button class="btn btn--sm" data-turno data-trat="${U.esc(s.tratamiento)}">Sacar turno ${use("i-arrow")}</button>
      </div>
    </article>`).join("");

  /* ---------- Tratamientos + filtros ---------- */
  const cats = ["Todos"].concat(C.categorias);
  $("#filters").innerHTML = cats.map((c, i) => `<button class="pill${i === 0 ? " is-active" : ""}" aria-pressed="${i === 0}" data-cat="${U.esc(c)}">${U.esc(c)}</button>`).join("");
  $("#tratGrid").innerHTML = S.tratamientos().map((t) => `
    <article class="trat-card reveal" data-cat="${U.esc(t.categoria)}">
      <div class="trat-top">
        <span class="trat-ico">${icon(t.icono)}</span>
        <span class="trat-cat">${U.esc(t.categoria)}</span>
      </div>
      <h3>${U.esc(t.nombre)}</h3>
      <p>${U.esc(t.descripcion)}</p>
      <div class="trat-meta">
        <span class="trat-dur">${use("i-clock")}${t.duracion} min${C.mostrarPrecios ? ` · <span class="trat-price">Desde ${U.money(t.precio)}</span>` : ""}</span>
        <button class="btn btn--xs" data-turno data-trat="${U.esc(t.id)}">Sacar turno</button>
      </div>
    </article>`).join("");

  $("#filters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    $$("#filters .pill").forEach((p) => { const on = p === b; p.classList.toggle("is-active", on); p.setAttribute("aria-pressed", String(on)); });
    const cat = b.dataset.cat;
    const cards = $$("#tratGrid .trat-card");
    cards.forEach((c) => c.classList.toggle("is-hidden", cat !== "Todos" && c.dataset.cat !== cat));
    if (window.gsap && !reduced) {
      const visibles = cards.filter((c) => !c.classList.contains("is-hidden"));
      gsap.fromTo(visibles, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .45, stagger: .04, ease: "power2.out", overwrite: true, clearProps: "transform,opacity" });
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }
  });

  /* ---------- Equipo ---------- */
  $("#teamGrid").innerHTML = C.profesionales.map((p) => `
    <article class="team-card reveal">
      <div class="team-top">
        <div class="avatar" aria-hidden="true">${U.esc(p.iniciales)}</div>
        <div><h3>${U.esc(p.nombre)}</h3><span class="eyebrow">${U.esc(p.especialidad)}</span></div>
      </div>
      <p>${U.esc(p.bio)}</p>
      <div class="tags">${(p.etiquetas || []).map((t) => `<span class="tag">${U.esc(t)}</span>`).join("")}</div>
      <div><button class="btn btn--sm btn--ghost" data-turno data-pro="${U.esc(p.id)}">Sacar turno con ${U.esc(p.corto)} ${use("i-arrow")}</button></div>
    </article>`).join("");

  /* ---------- Galería + lightbox ---------- */
  const fotos = C.galeria;
  $("#gallery").innerHTML = fotos.map((f, i) => `
    <button class="reveal" data-i="${i}" data-cap="${U.esc(f.texto)}" aria-label="Ver foto: ${U.esc(f.texto)}">
      <img src="${U.esc(f.foto)}" alt="${U.esc(f.texto)}" loading="lazy" decoding="async" width="1600" height="1067">
    </button>`).join("");

  // Las fotos son "lazy" para que la página abra rápido, pero apenas termina de cargar
  // se piden todas: así, aunque se haga scroll rápido, ya están listas al llegar.
  const precargarGaleria = () => $$("#gallery img").forEach((img) => { img.loading = "eager"; });
  if (document.readyState === "complete") precargarGaleria();
  else window.addEventListener("load", () => setTimeout(precargarGaleria, 300));
  // Y si el usuario llega antes, se piden cuando la sección está cerca.
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) { precargarGaleria(); io.disconnect(); } }, { rootMargin: "1200px 0px" });
    io.observe($("#gallery"));
  }

  const lb = $("#lightbox"), lbImg = $("#lbImg"), lbCap = $("#lbCap");
  let lbIdx = 0, lbPrevFocus = null;
  function lbShow(i) {
    lbIdx = (i + fotos.length) % fotos.length;
    lbImg.src = fotos[lbIdx].foto;
    lbImg.alt = fotos[lbIdx].texto;
    lbCap.textContent = `${fotos[lbIdx].texto} · ${lbIdx + 1} / ${fotos.length}`;
    if (window.gsap && !reduced) gsap.fromTo(lbImg, { opacity: 0, scale: .98 }, { opacity: 1, scale: 1, duration: .35, ease: "power2.out" });
  }
  function lbOpen(i) { lbPrevFocus = document.activeElement; lb.hidden = false; document.body.style.overflow = "hidden"; lbShow(i); $(".lb-close", lb).focus(); }
  function lbClose() { lb.hidden = true; document.body.style.overflow = ""; if (lbPrevFocus) lbPrevFocus.focus(); }
  $("#gallery").addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) lbOpen(Number(b.dataset.i)); });
  lb.addEventListener("click", (e) => {
    const a = e.target.closest("[data-lb]");
    if (a) { const k = a.dataset.lb; if (k === "close") lbClose(); else lbShow(lbIdx + (k === "next" ? 1 : -1)); }
    else if (e.target === lb) lbClose();
  });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") lbClose();
    if (e.key === "ArrowRight") lbShow(lbIdx + 1);
    if (e.key === "ArrowLeft") lbShow(lbIdx - 1);
  });
  let tx = null;
  lb.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (tx == null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) lbShow(lbIdx + (dx < 0 ? 1 : -1));
    tx = null;
  });

  /* ---------- Opiniones ---------- */
  $("#reviews").innerHTML = C.opiniones.map((o) => `
    <figure class="review reveal">
      <div class="stars" aria-label="${o.estrellas} de 5 estrellas">${Array.from({ length: o.estrellas }, () => use("i-star")).join("")}</div>
      <blockquote>“${U.esc(o.texto)}”</blockquote>
      <footer><span class="mini-av">${U.esc(U.iniciales(o.nombre))}</span><span><b>${U.esc(o.nombre)}</b><small>${U.esc(o.tratamiento)}</small></span></footer>
    </figure>`).join("");

  /* ---------- Obras sociales ---------- */
  $("#obrasList").innerHTML = C.obrasSociales.map((o) => `<span>${U.esc(o)}</span>`).join("");

  /* ---------- Preguntas ---------- */
  $("#faq").innerHTML = C.preguntas.map((q, i) => `
    <div class="faq-item reveal">
      <button class="faq-q" aria-expanded="false" aria-controls="faq-a-${i}" id="faq-q-${i}">${U.esc(q.p)}<i aria-hidden="true"></i></button>
      <div class="faq-a" id="faq-a-${i}" role="region" aria-labelledby="faq-q-${i}"><div><p>${U.esc(q.r)}</p></div></div>
    </div>`).join("");
  $("#faq").addEventListener("click", (e) => {
    const q = e.target.closest(".faq-q");
    if (!q) return;
    const item = q.parentElement;
    const open = !item.classList.contains("is-open");
    $$("#faq .faq-item").forEach((it) => { it.classList.remove("is-open"); $(".faq-q", it).setAttribute("aria-expanded", "false"); });
    item.classList.toggle("is-open", open);
    q.setAttribute("aria-expanded", String(open));
  });

  /* ---------- Próximo turno disponible (hero) ---------- */
  function heroChip() {
    const chip = $("#heroChip");
    const dias = S.dias("consulta", "any", 10);
    const d = dias.find((x) => x.libres.length);
    if (!d) { chip.hidden = true; return; }
    const n = U.diffDias(d.fecha);
    const cuando = n === 0 ? "Hoy" : n === 1 ? "Mañana" : U.fmtDia(d.fecha).replace(/^./, (c) => c.toUpperCase());
    $("#heroChipText").textContent = `${cuando} · ${d.libres[0].hora} hs`;
    chip.hidden = false;
  }
  heroChip();
  S.on(() => { heroChip(); wireWA(); });

  /* ---------- Abrir el sistema de turnos ---------- */
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-turno]");
    if (!b || !window.LumenBooking) return;
    e.preventDefault();
    window.LumenBooking.open({ tratamiento: b.dataset.trat || null, profesional: b.dataset.pro || null });
  });

  /* ---------- Animaciones ---------- */
  function animar() {
    if (!window.gsap || !window.ScrollTrigger || reduced) return;
    gsap.registerPlugin(ScrollTrigger);
    const els = $$(".reveal");
    // Hero: entra apenas carga.
    const hero = els.filter((el) => el.closest(".hero"));
    gsap.fromTo(hero, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .08, ease: "power3.out", clearProps: "transform,opacity" });
    // El resto: al aparecer en pantalla, en tandas.
    // Las fotos de la galería no se vuelven transparentes al entrar (solo suben),
    // así nunca se ve un recuadro vacío si alguien baja rápido.
    const fotos = els.filter((el) => el.closest("#gallery"));
    gsap.set(fotos, { y: 26 });
    ScrollTrigger.batch(fotos, {
      start: "top 98%",
      once: true,
      onEnter: (batch) => gsap.to(batch, { y: 0, duration: .7, stagger: .05, ease: "power3.out", clearProps: "transform", overwrite: true })
    });
    const resto = els.filter((el) => !el.closest(".hero") && !el.closest("#gallery"));
    gsap.set(resto, { y: 26, opacity: 0 });
    ScrollTrigger.batch(resto, {
      start: "top 92%",
      once: true,
      onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, duration: .8, stagger: .07, ease: "power3.out", clearProps: "transform,opacity", overwrite: true })
    });
    // Seguro: si por algo un elemento no se animó, que nunca quede invisible.
    const mostrarTodo = () => resto.forEach((el) => { if (getComputedStyle(el).opacity !== "1" && el.getBoundingClientRect().top < window.innerHeight) gsap.to(el, { y: 0, opacity: 1, duration: .4, clearProps: "transform,opacity" }); });
    window.addEventListener("load", () => { ScrollTrigger.refresh(); setTimeout(mostrarTodo, 1200); });
    setTimeout(mostrarTodo, 4000);
    // Parallax suave en la foto principal.
    gsap.fromTo(".hero-photo img", { yPercent: -2.5, scale: 1.08 }, { yPercent: 2.5, scale: 1.08, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  }
  if (document.readyState === "complete") animar(); else window.addEventListener("DOMContentLoaded", animar);
})();
