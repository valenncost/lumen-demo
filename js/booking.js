/* =========================================================================
   LUMEN · SISTEMA DE TURNOS (paciente)
   Pasos: 1 Tratamiento · 2 Profesional · 3 Día y hora · 4 Tus datos ·
          5 Revisá y confirmá · 6 Listo
   ========================================================================= */
(function () {
  "use strict";
  const { config: C, store: S, util: U } = window.Lumen;
  const icon = window.LumenIcon;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const use = (id) => `<svg><use href="#${id}"/></svg>`;

  const root = $("#booking");
  const panel = $(".booking-panel", root);
  const body = $("#bkBody");
  const foot = $("#bkFoot");
  const back = $("#bkBack");
  const PASOS = ["Tratamiento", "Profesional", "Día y hora", "Tus datos", "Confirmar"];
  const KEY_DATOS = "lumen.misDatos";

  let st = null;
  let dir = 1;
  let lastFocus = null;
  let pushed = false;

  const cap = (s) => String(s || "").replace(/^./, (c) => c.toUpperCase());
  const trat = () => S.tratamiento(st.trat);
  const proFinal = () => S.profesional(st.proAsignado || (st.pro !== "any" ? st.pro : null));

  function datosGuardados() {
    try { return JSON.parse(localStorage.getItem(KEY_DATOS)) || {}; } catch (e) { return {}; }
  }

  function reset() {
    const g = datosGuardados();
    st = {
      paso: 1, trat: null, pro: "any", fecha: null, hora: null, proAsignado: null, editando: false,
      datos: { nombre: g.nombre || "", whatsapp: g.whatsapp || "", email: g.email || "", obraSocial: g.obraSocial || "", primeraVez: g.nombre ? "no" : null, comentario: "" },
      errores: {}, aviso: "", turno: null
    };
  }

  /* ---------------------------------------------------------- abrir/cerrar */
  function open(opts) {
    opts = opts || {};
    reset();
    if (opts.profesional && S.profesional(opts.profesional)) st.pro = opts.profesional;
    if (opts.tratamiento && S.tratamiento(opts.tratamiento)) {
      st.trat = opts.tratamiento;
      st.paso = 2;
    }
    lastFocus = document.activeElement;
    root.hidden = false;
    document.body.classList.add("booking-lock");
    document.body.classList.remove("menu-open");
    requestAnimationFrame(() => root.classList.add("is-open"));
    dir = 1;
    render();
    setTimeout(() => $(".bk-close", root).focus({ preventScroll: true }), 50);
    // El botón "atrás" del celu cierra el sistema de turnos en vez de salir de la página.
    try { history.pushState({ lumenBooking: true }, ""); pushed = true; } catch (e) { pushed = false; }
  }

  function close(fromPop) {
    if (root.hidden) return;
    root.classList.remove("is-open");
    document.body.classList.remove("booking-lock");
    setTimeout(() => { root.hidden = true; body.innerHTML = ""; foot.innerHTML = ""; }, 320);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    if (pushed && !fromPop) { pushed = false; history.back(); }
    pushed = false;
  }
  window.addEventListener("popstate", () => { if (root.classList.contains("is-open")) { pushed = false; close(true); } });

  root.addEventListener("click", (e) => { if (e.target.closest("[data-bk='close']")) close(); });
  document.addEventListener("keydown", (e) => {
    if (root.hidden) return;
    if (e.key === "Escape" && $("#lightbox").hidden) close();
    if (e.key === "Tab") {
      const f = $$('button:not([disabled]), a[href], input, select, textarea', panel).filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  back.addEventListener("click", () => irA(st.paso - 1));

  /* ------------------------------------------------------------ navegación */
  function irA(n) {
    if (n < 1) return;
    dir = n >= st.paso ? 1 : -1;
    st.paso = n;
    st.aviso = "";
    render();
  }

  function horaSigueLibre() {
    if (!st.fecha || !st.hora || !st.trat) return false;
    const libres = S.horariosLibres(st.fecha, st.trat, st.pro);
    const h = libres.find((x) => x.hora === st.hora);
    if (!h) return false;
    if (st.proAsignado && !h.profesionales.includes(st.proAsignado)) st.proAsignado = h.profesionales[0];
    return true;
  }

  function datosValidos() { return Object.keys(validar(st.datos)).length === 0; }

  // Después de elegir algo: si venía de "Cambiar" y todo sigue bien, vuelve al resumen.
  function siguiente() {
    if (st.editando && st.trat && horaSigueLibre() && datosValidos()) { irA(5); return; }
    if (st.editando && st.paso < 3 && !horaSigueLibre()) { st.hora = null; irA(3); return; }
    irA(st.paso + 1);
  }

  /* ---------------------------------------------------------------- render */
  function render() {
    const p = st.paso;
    back.classList.toggle("is-hidden", p === 1 || p === 6);
    $("#bkStepLabel").textContent = p === 6 ? "Turno reservado" : `Paso ${p} de 5`;
    $("#bkTitle").textContent = p === 6 ? "¡Listo!" : PASOS[p - 1];
    $("#bkBar").style.width = Math.min(100, (p / 5) * 100) + "%";
    $("#bkSteps").innerHTML = PASOS.map((n, i) => `<li class="${i + 1 < p ? "is-done" : i + 1 === p ? "is-current" : ""}"><i>${i + 1 < p ? "✓" : i + 1}</i>${n}</li>`).join("");

    const vistas = { 1: vTratamiento, 2: vProfesional, 3: vDiaHora, 4: vDatos, 5: vResumen, 6: vListo };
    body.innerHTML = `<div class="bk-view${dir < 0 ? " is-back" : ""}">${vistas[p]()}</div>`;
    body.scrollTop = 0;
    renderFoot();
    if (p === 3) montarCalendario();
    if (p === 4) montarFormulario();
  }

  function resumenCorto() {
    const t = trat();
    if (!t) return "";
    let l2 = `${t.duracion} min`;
    if (st.fecha && st.hora) l2 = `${cap(U.fmtDia(st.fecha))} · ${st.hora} hs`;
    else if (st.pro !== "any") l2 += ` · ${S.profesional(st.pro).corto}`;
    return `<div class="bk-foot-sum"><b>${U.esc(t.nombre)}</b>${U.esc(l2)}</div>`;
  }

  function renderFoot() {
    const p = st.paso;
    if (p === 1 || p === 2) { foot.innerHTML = st.trat && p === 2 ? resumenCorto() : ""; return; }
    if (p === 3) {
      foot.innerHTML = `${resumenCorto()}<button class="btn" id="bkNext"${st.hora ? "" : " disabled"}>Continuar ${use("i-arrow")}</button>`;
      $("#bkNext").addEventListener("click", siguiente);
      return;
    }
    if (p === 4) {
      foot.innerHTML = `${resumenCorto()}<button class="btn" id="bkNext">Revisar turno ${use("i-arrow")}</button>`;
      $("#bkNext").addEventListener("click", () => {
        st.errores = validar(st.datos);
        if (Object.keys(st.errores).length) { pintarErrores(true); return; }
        guardarDatos();
        st.editando = false;
        irA(5);
      });
      return;
    }
    if (p === 5) {
      foot.innerHTML = `<button class="btn btn--lg btn--block" id="bkConfirm">${use("i-check")}Confirmar turno</button>`;
      $("#bkConfirm").addEventListener("click", confirmar);
      return;
    }
    foot.innerHTML = "";
  }

  /* ----------------------------------------------------- 1 · Tratamiento */
  function vTratamiento() {
    const pro = st.pro !== "any" ? S.profesional(st.pro) : null;
    const lista = S.tratamientos().filter((t) => !pro || t.profesionales.includes(pro.id));
    const grupos = C.categorias.map((cat) => ({ cat, items: lista.filter((t) => t.categoria === cat) })).filter((g) => g.items.length);
    const filtro = pro ? `<p class="bk-p">Tratamientos que hace ${U.esc(pro.articulo)}. <button class="link-btn" data-all>Ver todos</button></p>` : `<p class="bk-p">Si no sabés qué necesitás, elegí <b>Consulta y evaluación</b>: es sin cargo la primera vez.</p>`;
    setTimeout(() => {
      $$("[data-trat-opt]", body).forEach((b) => b.addEventListener("click", () => {
        const id = b.dataset.tratOpt;
        const cambio = id !== st.trat;
        st.trat = id;
        if (st.pro !== "any" && !S.tratamiento(id).profesionales.includes(st.pro)) st.pro = "any";
        if (cambio && !st.editando) { st.hora = null; st.proAsignado = null; }
        $$("[data-trat-opt]", body).forEach((x) => x.classList.toggle("is-selected", x === b));
        setTimeout(siguiente, 200);
      }));
      const all = $("[data-all]", body);
      if (all) all.addEventListener("click", () => { st.pro = "any"; render(); });
    });
    return `<h2 class="bk-h">¿Qué tratamiento necesitás?</h2>${filtro}` + grupos.map((g) => `
      <p class="bk-group-title">${U.esc(g.cat)}</p>
      <div class="bk-opts">${g.items.map((t) => `
        <button class="bk-opt${st.trat === t.id ? " is-selected" : ""}" data-trat-opt="${t.id}">
          <span class="bk-opt-ico">${icon(t.icono)}</span>
          <span class="bk-opt-text"><b>${U.esc(t.nombre)}</b><small>${t.duracion} min · ${U.esc(t.descripcion)}</small></span>
          <span class="bk-radio"></span>
        </button>`).join("")}
      </div>`).join("");
  }

  /* ----------------------------------------------------- 2 · Profesional */
  function vProfesional() {
    const t = trat();
    const pros = S.profesionales();
    setTimeout(() => {
      $$("[data-pro-opt]", body).forEach((b) => b.addEventListener("click", () => {
        st.pro = b.dataset.proOpt;
        st.proAsignado = st.pro === "any" ? null : st.pro;
        $$("[data-pro-opt]", body).forEach((x) => x.classList.toggle("is-selected", x === b));
        setTimeout(siguiente, 200);
      }));
    });
    return `<h2 class="bk-h">¿Con quién te querés atender?</h2>
      <p class="bk-p">Para <b>${U.esc(t.nombre)}</b>. Si te da lo mismo, te mostramos todos los horarios libres.</p>
      <div class="bk-opts">
        <button class="bk-opt${st.pro === "any" ? " is-selected" : ""}" data-pro-opt="any">
          <span class="bk-opt-ico any">${icon("pacientes")}</span>
          <span class="bk-opt-text"><b>Cualquiera disponible</b><small>Más horarios para elegir</small></span>
          <span class="bk-radio"></span>
        </button>
        ${pros.map((p) => {
          const hace = t.profesionales.includes(p.id);
          return `<button class="bk-opt${st.pro === p.id ? " is-selected" : ""}" data-pro-opt="${p.id}"${hace ? "" : " disabled"}>
            <span class="bk-opt-ico avatar">${U.esc(p.iniciales)}</span>
            <span class="bk-opt-text"><b>${U.esc(p.nombre)}</b><small>${hace ? U.esc(p.especialidad) : "No realiza este tratamiento"}</small></span>
            <span class="bk-radio"></span>
          </button>`;
        }).join("")}
      </div>`;
  }

  /* ------------------------------------------------------ 3 · Día y hora */
  let diasCache = [];
  function vDiaHora() {
    diasCache = S.dias(st.trat, st.pro, C.turnos.diasAnticipacion);
    if (st.fecha && !diasCache.some((d) => d.fecha === st.fecha && d.libres.length)) { st.fecha = null; st.hora = null; }
    if (!st.fecha) { const d = diasCache.find((x) => x.libres.length); if (d) st.fecha = d.fecha; }
    if (st.hora && !(diasCache.find((d) => d.fecha === st.fecha) || { libres: [] }).libres.some((h) => h.hora === st.hora)) st.hora = null;
    const pro = st.pro !== "any" ? S.profesional(st.pro) : null;
    return `<h2 class="bk-h">Elegí día y horario</h2>
      <p class="bk-p">${U.esc(trat().nombre)} · ${trat().duracion} min${pro ? " · " + U.esc(pro.nombre) : ""}</p>
      ${st.aviso ? `<div class="bk-error" role="alert">${U.esc(st.aviso)}</div>` : ""}
      <div id="calWrap"></div>
      <div class="slots-wrap" id="slotsWrap" aria-live="polite"></div>`;
  }

  function montarCalendario() {
    const wrap = $("#calWrap");
    const primero = U.parseISO(diasCache[0].fecha);
    const offset = (primero.getDay() + 6) % 7; // semana empieza el lunes
    const meses = Array.from(new Set(diasCache.map((d) => U.MESES[U.parseISO(d.fecha).getMonth()])));
    const wd = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    let html = `<div class="cal-month"><b>${meses.join(" / ")}</b><small>Próximas 3 semanas</small></div><div class="cal" role="grid">`;
    html += wd.map((d) => `<span class="cal-wd">${d}</span>`).join("");
    for (let i = 0; i < offset; i++) html += `<span class="cal-blank"></span>`;
    diasCache.forEach((d, i) => {
      const f = U.parseISO(d.fecha);
      const ok = d.libres.length > 0;
      // nota larga para pantallas normales y corta para celus angostos
      let nota = "", corta = "";
      if (d.feriado) { nota = "Feriado"; corta = "Fer."; }
      else if (!d.abierto) { nota = "Cerrado"; corta = "—"; }
      else if (!ok) { nota = i === 0 ? "—" : "Completo"; corta = i === 0 ? "—" : "Lleno"; }
      else if (i === 0) { nota = corta = "Hoy"; }
      else { nota = `${d.libres.length} libres`; corta = String(d.libres.length); }
      html += `<button class="cal-day${i === 0 ? " is-today" : ""}${d.feriado ? " is-holiday" : ""}${st.fecha === d.fecha ? " is-selected" : ""}" data-day="${d.fecha}"${ok ? "" : " disabled"} aria-label="${U.esc(cap(U.fmtDiaLargo(d.fecha)))}${ok ? "" : ", sin turnos"}" title="${d.feriado ? U.esc(d.feriado.nombre) : ""}">${f.getDate()}<small><span class="nota-lg">${nota}</span><span class="nota-sm">${corta}</span></small></button>`;
    });
    html += `</div><div class="cal-legend"><span class="nota-sm-ley">El número chico es la cantidad de horarios libres</span><span>Domingos y feriados cerrado</span><span>Sábados solo a la mañana</span></div>`;
    wrap.innerHTML = html;
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest("[data-day]");
      if (!b || b.disabled) return;
      st.fecha = b.dataset.day;
      st.hora = null;
      $$(".cal-day", wrap).forEach((x) => x.classList.toggle("is-selected", x === b));
      montarHorarios(true);
      renderFoot();
    });
    montarHorarios(false);
  }

  function montarHorarios(scroll) {
    const sw = $("#slotsWrap");
    if (!st.fecha) {
      sw.innerHTML = `<div class="slots-empty">No hay horarios libres en las próximas semanas. Escribinos por WhatsApp y te buscamos un lugar.</div>`;
      return;
    }
    const d = diasCache.find((x) => x.fecha === st.fecha);
    const man = d.libres.filter((h) => U.toMin(h.hora) < 13 * 60);
    const tar = d.libres.filter((h) => U.toMin(h.hora) >= 13 * 60);
    const grupo = (titulo, arr) => arr.length ? `<p class="bk-group-title">${titulo}</p><div class="slots">${arr.map((h) => `<button class="slot${st.hora === h.hora ? " is-selected" : ""}" data-hora="${h.hora}">${h.hora}</button>`).join("")}</div>` : "";
    sw.innerHTML = `<h3 class="slots-title">${U.esc(cap(U.fmtDiaLargo(st.fecha)))}</h3>${grupo("Mañana", man)}${grupo("Tarde", tar)}`;
    $$(".slot", sw).forEach((b) => b.addEventListener("click", () => {
      st.hora = b.dataset.hora;
      const h = d.libres.find((x) => x.hora === st.hora);
      // "Cualquiera disponible": asignamos un profesional libre en ese horario.
      st.proAsignado = st.pro === "any" ? h.profesionales[Math.floor(Math.random() * h.profesionales.length)] : st.pro;
      $$(".slot", sw).forEach((x) => x.classList.toggle("is-selected", x === b));
      renderFoot();
      const n = $("#bkNext");
      if (n && window.matchMedia("(max-width: 759px)").matches) n.scrollIntoView({ block: "nearest" });
    }));
    if (scroll) sw.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  /* ------------------------------------------------------- 4 · Tus datos */
  function validar(d) {
    const e = {};
    const nom = (d.nombre || "").trim();
    if (nom.length < 3) e.nombre = "Escribí tu nombre y apellido.";
    else if (nom.split(/\s+/).length < 2) e.nombre = "Falta el apellido.";
    const tel = String(d.whatsapp || "").replace(/\D/g, "").replace(/^0/, "");
    if (!tel) e.whatsapp = "Necesitamos tu WhatsApp para confirmarte el turno.";
    else if (tel.length < 10 || tel.length > 13) e.whatsapp = "Revisá el número: poné el código de área sin el 0 ni el 15 (ej: 291 412 3456).";
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e.email = "El email no parece válido (o dejalo vacío, es opcional).";
    if (!d.obraSocial) e.obraSocial = "Elegí tu obra social, o Particular.";
    if (d.primeraVez !== "si" && d.primeraVez !== "no") e.primeraVez = "Contanos si es tu primera vez.";
    return e;
  }

  function vDatos() {
    const d = st.datos;
    const f = (id, label, input, opt) => `
      <div class="field" data-f="${id}">
        <label for="f-${id}">${label}${opt ? ' <span class="opt">(opcional)</span>' : ""}</label>
        ${input}
        <span class="field-error" id="e-${id}"></span>
      </div>`;
    return `<h2 class="bk-h">Tus datos</h2>
      <p class="bk-p">Los usamos solo para confirmarte el turno y mandarte el recordatorio.</p>
      <form class="bk-form" id="bkForm" novalidate>
        ${f("nombre", "Nombre y apellido", `<input class="input" id="f-nombre" name="nombre" autocomplete="name" value="${U.esc(d.nombre)}" placeholder="Ej: Sofía Gómez">`)}
        <div class="row">
          ${f("whatsapp", "WhatsApp", `<input class="input" id="f-whatsapp" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" value="${U.esc(d.whatsapp)}" placeholder="291 412 3456">`)}
          ${f("email", "Email", `<input class="input" id="f-email" name="email" type="email" inputmode="email" autocomplete="email" value="${U.esc(d.email)}" placeholder="tu@email.com">`, true)}
        </div>
        ${f("obraSocial", "Obra social", `<select class="select" id="f-obraSocial" name="obraSocial"><option value="">Elegí una opción</option>${C.obrasSociales.map((o) => `<option${d.obraSocial === o ? " selected" : ""}>${U.esc(o)}</option>`).join("")}<option${d.obraSocial === "Otra" ? " selected" : ""} value="Otra">Otra (la consultamos)</option></select>`)}
        <div class="field" data-f="primeraVez">
          <span class="field-label" id="l-pv">¿Es tu primera vez en Lumen?</span>
          <div class="seg" role="radiogroup" aria-labelledby="l-pv">
            <label><input type="radio" name="primeraVez" value="si"${d.primeraVez === "si" ? " checked" : ""}><span>Sí, es la primera</span></label>
            <label><input type="radio" name="primeraVez" value="no"${d.primeraVez === "no" ? " checked" : ""}><span>No, ya vine</span></label>
          </div>
          <span class="field-error" id="e-primeraVez"></span>
        </div>
        ${f("comentario", "Comentario", `<textarea class="textarea" id="f-comentario" name="comentario" placeholder="Ej: me duele una muela, prefiero que me llamen a la tarde…">${U.esc(d.comentario)}</textarea>`, true)}
      </form>`;
  }

  function montarFormulario() {
    const form = $("#bkForm");
    form.addEventListener("input", (e) => {
      const el = e.target;
      if (!el.name) return;
      st.datos[el.name] = el.value;
      if (st.errores[el.name]) {
        const err = validar(st.datos)[el.name];
        if (!err) { delete st.errores[el.name]; pintarErrores(); }
      }
    });
    form.addEventListener("change", (e) => { if (e.target.name) { st.datos[e.target.name] = e.target.value; if (st.errores[e.target.name] && !validar(st.datos)[e.target.name]) { delete st.errores[e.target.name]; pintarErrores(); } } });
    form.addEventListener("submit", (e) => { e.preventDefault(); $("#bkNext").click(); });
    pintarErrores();
  }

  function pintarErrores(enfocar) {
    let primero = null;
    $$("[data-f]", body).forEach((fd) => {
      const k = fd.dataset.f;
      const msg = st.errores[k];
      fd.classList.toggle("has-error", !!msg);
      const el = $("#e-" + k);
      if (el) el.textContent = msg || "";
      const inp = $("input, select, textarea", fd);
      if (inp) { inp.setAttribute("aria-invalid", msg ? "true" : "false"); if (msg) inp.setAttribute("aria-describedby", "e-" + k); }
      if (msg && !primero) primero = inp;
    });
    if (primero && enfocar) primero.focus();
  }

  function guardarDatos() {
    const d = st.datos;
    try { localStorage.setItem(KEY_DATOS, JSON.stringify({ nombre: d.nombre.trim(), whatsapp: d.whatsapp, email: d.email, obraSocial: d.obraSocial })); } catch (e) {}
  }

  /* --------------------------------------------- 5 · Revisá y confirmá */
  function filasResumen(conCambiar) {
    const t = trat(), p = proFinal(), d = st.datos;
    const fila = (k, v, paso) => `<div class="bk-sum-row"><small>${k}</small><span>${v}</span>${conCambiar && paso ? `<button class="link-btn" data-goto="${paso}">Cambiar</button>` : ""}</div>`;
    return fila("Tratamiento", `${U.esc(t.nombre)} · ${t.duracion} min`, 1)
      + fila("Profesional", U.esc(p ? p.nombre : "Cualquiera disponible") + (st.pro === "any" && p ? ' <span class="opt" style="color:var(--gray)">(asignado)</span>' : ""), 2)
      + fila("Día y hora", `${U.esc(cap(U.fmtDiaLargo(st.fecha)))} · ${st.hora} hs`, 3)
      + fila("Paciente", `${U.esc(d.nombre.trim())}<br><span style="color:var(--gray);font-weight:400">${U.esc(U.telVisible(U.normalizarTel(d.whatsapp)))}${d.email ? " · " + U.esc(d.email) : ""}</span>`, 4)
      + fila("Obra social · Primera vez", `${U.esc(d.obraSocial)} · ${d.primeraVez === "si" ? "Sí" : "No"}`, 4)
      + (d.comentario.trim() ? fila("Comentario", U.esc(d.comentario.trim()), 4) : "");
  }

  function vResumen() {
    setTimeout(() => $$("[data-goto]", body).forEach((b) => b.addEventListener("click", () => { st.editando = true; irA(Number(b.dataset.goto)); })));
    return `<h2 class="bk-h">Revisá y confirmá</h2>
      <p class="bk-p">Fijate que esté todo bien. Podés cambiar cualquier dato.</p>
      ${st.aviso ? `<div class="bk-error" role="alert" style="margin-bottom:14px">${U.esc(st.aviso)}</div>` : ""}
      <div class="bk-sum">${filasResumen(true)}</div>
      <div class="bk-note">${use("i-wa")}<div><b>No se paga nada en la web.</b> ${C.modoDemo ? "Al confirmar, el consultorio recibe los datos de tu turno por WhatsApp." : "Al confirmar se abre WhatsApp con los datos de tu turno."} Los pagos y señas, si hacen falta, los coordinás con la secretaria por ahí.</div></div>`;
  }

  function mensajeConsultorio(t) {
    return [
      "Hola Lumen! Reservé un turno desde la web 🦷",
      "",
      `Paciente: ${t.paciente}`,
      `Tratamiento: ${t.tratamiento}`,
      `Profesional: ${t.profesional}`,
      `Día: ${U.fmtDia(t.fecha)} · ${t.hora} hs`,
      `Obra social: ${t.obraSocial}`,
      `Primera vez: ${t.primeraVez ? "Sí" : "No"}`,
      `Comentario: ${t.comentario || "—"}`,
      "",
      `Código de turno: ${t.codigo}`
    ].join("\n");
  }

  function confirmar() {
    // Último control: que nadie haya tomado el horario mientras completabas los datos.
    if (!horaSigueLibre()) {
      st.hora = null;
      st.aviso = "Uy, ese horario se acaba de ocupar. Elegí otro, por favor.";
      dir = -1; st.paso = 3; render();
      return;
    }
    const t = trat(), p = proFinal(), d = st.datos;
    const turno = S.crearTurno({
      origen: "web",
      estado: "nuevo",
      paciente: d.nombre.trim().replace(/\s+/g, " "),
      whatsapp: d.whatsapp,
      email: d.email.trim(),
      obraSocial: d.obraSocial,
      primeraVez: d.primeraVez === "si",
      tratamientoId: t.id,
      tratamiento: t.nombre,
      profesionalId: p.id,
      profesional: p.nombre,
      fecha: st.fecha,
      hora: st.hora,
      duracion: t.duracion,
      comentario: d.comentario.trim()
    });
    st.turno = turno;
    // En el consultorio real se abre WhatsApp al toque; en el demo solo se muestra cómo le llega.
    if (!C.modoDemo) U.abrirWhatsApp(S.ajustes().whatsapp, mensajeConsultorio(turno));
    dir = 1; st.paso = 6; st.editando = false;
    render();
  }

  /* ------------------------------------------------------------ 6 · Listo */
  function vListo() {
    const t = st.turno;
    const demo = !!C.modoDemo;
    setTimeout(() => {
      $("#bkIcs").addEventListener("click", () => descargarICS(t));
      const wa = $("#bkWa");
      if (wa) wa.addEventListener("click", () => U.abrirWhatsApp(S.ajustes().whatsapp, mensajeConsultorio(t)));
      $("#bkCancel").addEventListener("click", () => U.abrirWhatsApp(S.ajustes().whatsapp, `Hola, quiero cancelar/cambiar el turno ${t.codigo}`, "Así se pide cancelar o cambiar el turno"));
      $("#bkOtro").addEventListener("click", () => { reset(); dir = 1; render(); });
    });
    const nombre = U.primerNombre(t.paciente);
    const demoCard = demo ? `
      <div class="bk-demo-wa">
        <p class="bk-demo-wa-title">Así le llega a la secretaria</p>
        ${U.burbujaWA(mensajeConsultorio(t))}
        <p class="bk-demo-wa-note">En el demo no se envía nada. En el consultorio real, este mensaje le llega por WhatsApp.</p>
        <a class="btn btn--lg btn--block" href="panel.html?demo" target="_blank" rel="noopener">Ver cómo le aparece al consultorio ${use("i-arrow")}</a>
      </div>` : "";
    return `<div class="bk-done">
      <svg class="check-anim" viewBox="0 0 88 88" aria-hidden="true"><circle cx="44" cy="44" r="40"/><path d="M28 45.5l10.5 10.5L61 33"/></svg>
      <h2 class="bk-h">¡Listo! Tu turno quedó reservado.</h2>
      <p class="bk-p">Te escribimos por WhatsApp para confirmarlo y coordinar el pago si hace falta.</p>
      <span class="bk-code">Código ${U.esc(t.codigo)}</span>
      ${demoCard}
      <div class="bk-sum">
        <div class="bk-sum-row"><small>Tratamiento</small><span>${U.esc(t.tratamiento)} · ${t.duracion} min</span></div>
        <div class="bk-sum-row"><small>Profesional</small><span>${U.esc(t.profesional)}</span></div>
        <div class="bk-sum-row"><small>Día y hora</small><span>${U.esc(cap(U.fmtDiaLargo(t.fecha)))} · ${t.hora} hs</span></div>
        <div class="bk-sum-row"><small>Dirección</small><span>${U.esc(C.consultorio.direccionCompleta)}</span></div>
      </div>
      <div class="bk-actions">
        <button class="btn ${demo ? "btn--ghost" : "btn--lg"}" id="bkIcs">${use("i-cal")}Agregar a mi calendario</button>
        ${demo ? "" : `<button class="btn btn--wa" id="bkWa">${use("i-wa")}Volver a abrir WhatsApp</button>`}
        <button class="btn btn--ghost" id="bkCancel">Cancelar o cambiar turno</button>
      </div>
      <div class="notif-wrap">
        <div class="notif" role="img" aria-label="Vista previa del recordatorio por WhatsApp">
          <span class="notif-app">${use("i-wa")}</span>
          <div class="notif-body">
            <div class="notif-top"><span>WhatsApp</span><span>ahora</span></div>
            <b>${U.esc(C.consultorio.nombre)}:</b> Hola ${U.esc(nombre)}, te recordamos tu turno de mañana ${t.hora} 💬
          </div>
        </div>
        <p class="notif-cap">Así te llega el recordatorio 24 hs antes</p>
      </div>
      <p style="margin-top:22px"><button class="link-btn" id="bkOtro">Sacar otro turno</button></p>
    </div>`;
  }

  /* ----------------------------------------------------------------- .ics */
  function descargarICS(t) {
    const [y, m, d] = t.fecha.split("-").map(Number);
    const [hh, mm] = t.hora.split(":").map(Number);
    const ini = new Date(y, m - 1, d, hh, mm);
    const fin = new Date(ini.getTime() + t.duracion * 60000);
    const z = (dt) => dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const e = (s) => String(s).replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lumen Odontologia//Turnos//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${t.codigo}-${t.id}@lumen.demo`,
      `DTSTAMP:${z(new Date())}`,
      `DTSTART:${z(ini)}`,
      `DTEND:${z(fin)}`,
      `SUMMARY:${e("Turno " + C.consultorio.nombre + " · " + t.tratamiento)}`,
      `LOCATION:${e(C.consultorio.direccionCompleta)}`,
      `DESCRIPTION:${e(`Profesional: ${t.profesional}\nCódigo de turno: ${t.codigo}\nPara cancelar o cambiar: https://wa.me/${S.ajustes().whatsapp}`)}`,
      "BEGIN:VALARM", "TRIGGER:-PT24H", "ACTION:DISPLAY", `DESCRIPTION:${e("Mañana tenés turno en " + C.consultorio.nombre)}`, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `turno-${t.codigo}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  window.LumenBooking = { open, close };
})();
