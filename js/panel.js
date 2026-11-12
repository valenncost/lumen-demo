/* =========================================================================
   LUMEN · PANEL DEL CONSULTORIO
   Vistas: Hoy · Agenda · Pacientes · Pagos · Ajustes
   ========================================================================= */
(function () {
  "use strict";
  const { config: C, store: S, util: U } = window.Lumen;
  const I = window.LumenIcon;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = U.esc;

  const ESTADOS = { nuevo: "Nuevo", confirmado: "Confirmado", atendido: "Atendido", cancelado: "Cancelado", ausente: "Ausente" };
  const PAGO_ESTADOS = { pagado: "Pagado", "seña": "Seña", pendiente: "Pendiente" };
  const PAGO_CLASE = { pagado: "confirmado", "seña": "nuevo", pendiente: "cancelado" };
  const PRO_COLORES = ["#C9A27E", "#8FAE9C", "#A99BC4", "#C99A9A"];
  const VISTAS = [
    { id: "hoy", label: "Hoy", icon: "hoy" },
    { id: "agenda", label: "Agenda", icon: "agenda" },
    { id: "pacientes", label: "Pacientes", icon: "pacientes" },
    { id: "pagos", label: "Pagos", icon: "pagos" },
    { id: "ajustes", label: "Ajustes", icon: "ajustes" }
  ];
  const SES = "lumen.sesion";
  const TIP = "lumen.demoTip"; // cartelito de bienvenida del modo demo
  // panel.html?demo → entra directo, sin PIN (para mostrar el demo desde la web).
  const MODO_DEMO = new URLSearchParams(location.search).has("demo");

  /* --------------------------------------------------------------- helpers */
  const cap = (s) => String(s || "").replace(/^./, (c) => c.toUpperCase());
  const byFH = (a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora);
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const proIdx = (id) => Math.max(0, C.profesionales.findIndex((p) => p.id === id));
  const proColor = (id) => PRO_COLORES[proIdx(id) % PRO_COLORES.length];
  const proCorto = (id, fallback) => { const p = S.profesional(id); return p ? p.corto : fallback || ""; };
  const estadoTag = (e) => `<span class="estado estado--${e}">${ESTADOS[e] || e}</span>`;
  const pagoTag = (e) => `<span class="estado estado--${PAGO_CLASE[e] || "ausente"}">${PAGO_ESTADOS[e] || e}</span>`;
  const webTag = `<span class="web-tag">${I("web")}Web</span>`;
  const diaCorto = (iso) => { const d = U.parseISO(iso); return `${U.DIAS_CORTO[d.getDay()]} ${U.pad(d.getDate())}/${U.pad(d.getMonth() + 1)}`; };
  const fechaCorta = (iso) => { const d = U.parseISO(iso); return `${U.pad(d.getDate())}/${U.pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`; };
  const sum = (arr) => arr.reduce((a, p) => a + Number(p.monto || 0), 0);
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const lunes = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const cuandoTxt = (iso) => { const n = U.diffDias(iso); return n === 0 ? "hoy" : n === 1 ? "mañana" : n === -1 ? "ayer" : U.fmtDia(iso); };
  function hace(iso) {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return "recién";
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return `hace ${d} día${d > 1 ? "s" : ""}`;
  }
  function moneyCorto(n) {
    if (n >= 1e6) return "$" + (n / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " M";
    if (n >= 1e3) return "$" + Math.round(n / 1e3).toLocaleString("es-AR") + " mil";
    return U.money(n);
  }
  const pagadoDeTurno = (tid) => sum(S.pagos().filter((p) => p.turnoId === tid && p.estado !== "pendiente"));
  const tienePago = (tid) => S.pagos().some((p) => p.turnoId === tid);
  // En modo demo no abre WhatsApp: muestra cómo le llegaría el mensaje al paciente.
  const abrirWA = (num, texto) => U.abrirWhatsApp(num, texto, "Así le llega al paciente");
  const waPaciente = (t) => U.waLink(t.whatsapp, `Hola ${U.primerNombre(t.paciente || t.nombre)}! Te escribimos de ${C.consultorio.nombre}.`);

  const st = {
    vista: "hoy",
    semana: lunes(U.hoy()),
    dia: U.hoyISO(),
    pro: "todos",
    q: "",
    pagoFiltro: "todos"
  };

  /* ----------------------------------------------------------------- toast */
  function toast(msg, action) {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = I("check") + `<span>${esc(msg)}</span>` + (action ? `<button type="button">${esc(action.label)}</button>` : "");
    const quitar = () => { el.classList.add("is-out"); setTimeout(() => el.remove(), 300); };
    if (action) el.querySelector("button").addEventListener("click", () => { action.fn(); quitar(); });
    $("#toasts").appendChild(el);
    setTimeout(quitar, action ? 7000 : 3400);
  }

  /* ----------------------------------------------------------------- modal */
  function modal(o) {
    const root = document.createElement("div");
    root.className = "modal-root";
    root.innerHTML = `<div class="modal-backdrop"></div>
      <div class="modal${o.size ? " modal--" + o.size : ""}" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
        <div class="modal-head"><div><h2>${esc(o.title)}</h2>${o.sub ? `<p>${o.sub}</p>` : ""}</div><button class="modal-x" aria-label="Cerrar"><svg><use href="#i-close"/></svg></button></div>
        <div class="modal-body">${o.body || ""}</div>
        <div class="modal-foot"${o.foot ? "" : " hidden"}>${o.foot || ""}</div>
      </div>`;
    $("#modals").appendChild(root);
    document.body.style.overflow = "hidden";
    const prev = document.activeElement;
    root.close = () => {
      root.remove();
      if (!$("#modals").children.length) document.body.style.overflow = "";
      if (o.onClose) o.onClose();
      if (prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true });
    };
    root.body = $(".modal-body", root);
    root.foot = $(".modal-foot", root);
    root.setFoot = (html) => { root.foot.innerHTML = html || ""; root.foot.hidden = !html; };
    root.setHead = (title, sub) => { $(".modal-head h2", root).textContent = title; const p = $(".modal-head p", root); if (p) p.innerHTML = sub || ""; };
    $(".modal-backdrop", root).addEventListener("click", root.close);
    $(".modal-x", root).addEventListener("click", root.close);
    setTimeout(() => $(".modal-x", root).focus({ preventScroll: true }), 30);
    return root;
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const top = $("#modals").lastElementChild;
    if (top) top.close();
  });

  function confirmar(o) {
    return new Promise((res) => {
      const m = modal({
        title: o.title, size: "sm",
        body: `<p class="muted">${o.text || ""}</p>`,
        foot: `<button class="btn btn--ghost" data-no>Volver</button><button class="btn${o.danger ? " btn--danger" : ""}" data-ok>${esc(o.ok || "Confirmar")}</button>`,
        onClose: () => res(false)
      });
      $("[data-no]", m).addEventListener("click", m.close);
      $("[data-ok]", m).addEventListener("click", () => { res(true); m.close(); });
    });
  }

  /* -------------------------------------------------------------- acciones */
  const acciones = {
    confirmar(t) {
      S.actualizarTurno(t.id, { estado: "confirmado", confirmado: new Date().toISOString() });
      abrirWA(t.whatsapp, S.mensaje("confirmacion", t));
      toast(`Turno de ${U.primerNombre(t.paciente)} confirmado`);
    },
    rechazar(t) {
      abrirWA(t.whatsapp, S.mensaje("reprogramar", t));
      const antes = t.estado;
      S.actualizarTurno(t.id, { estado: "cancelado", motivo: "Rechazado / a reprogramar" });
      toast("Horario liberado. Coordiná el nuevo día por WhatsApp.", { label: "Deshacer", fn: () => S.actualizarTurno(t.id, { estado: antes, motivo: "" }) });
    },
    atendido(t) { S.actualizarTurno(t.id, { estado: "atendido" }); toast(`${U.primerNombre(t.paciente)}: atendido`, { label: "Registrar pago", fn: () => abrirCobro({ turnoId: t.id }) }); },
    ausente(t) { S.actualizarTurno(t.id, { estado: "ausente" }); toast(`${U.primerNombre(t.paciente)} marcado como ausente`); },
    recordatorio(t) {
      abrirWA(t.whatsapp, S.mensaje("recordatorio", t));
      S.actualizarTurno(t.id, { recordatorio: new Date().toISOString() });
      toast("Recordatorio armado en WhatsApp");
    },
    cancelar(t) {
      return confirmar({ title: "¿Cancelar este turno?", text: `${esc(t.paciente)} · ${esc(t.tratamiento)}<br>${esc(cap(U.fmtDia(t.fecha)))} · ${t.hora} hs<br><br>El horario queda libre para otro paciente.`, ok: "Sí, cancelar", danger: true })
        .then((ok) => {
          if (!ok) return false;
          S.actualizarTurno(t.id, { estado: "cancelado" });
          toast("Turno cancelado. El horario quedó libre.", { label: "Avisar por WhatsApp", fn: () => abrirWA(t.whatsapp, S.mensaje("reprogramar", t)) });
          return true;
        });
    },
    pago(t) { abrirCobro({ turnoId: t.id }); },
    ver(t) { abrirTurno(t.id); }
  };

  // Clicks en filas/botones de turnos (delegado para todas las vistas).
  document.addEventListener("click", (e) => {
    const holder = e.target.closest("[data-turno-id]");
    if (!holder || holder.closest(".modal-root")) return;
    const t = S.turno(holder.dataset.turnoId);
    if (!t) return;
    const act = e.target.closest("[data-act]");
    if (act) { e.stopPropagation(); acciones[act.dataset.act](t); return; }
    const inter = e.target.closest("a, button, input, select");
    if (inter && inter !== holder) return;
    abrirTurno(t.id);
  });
  // Comandos generales (botones de encabezado, accesos rápidos).
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cmd]");
    if (!b || b.closest(".modal-root")) return;
    const c = b.dataset.cmd;
    if (c === "nuevo") abrirNuevoTurno({});
    if (c === "bloquear") abrirBloqueo({});
    if (c === "cobro") abrirCobro({});
    if (c === "agenda") ir("agenda");
  });

  /* -------------------------------------------------------------- shell */
  function head(eyebrow, title, sub, actions) {
    $("#pageEyebrow").textContent = eyebrow || "";
    $("#pageTitle").textContent = title;
    $("#pageSub").innerHTML = sub || "";
    $("#pageActions").innerHTML = actions || "";
  }
  const btnNuevo = `<button class="btn" data-cmd="nuevo">${I("plus")}Nuevo turno</button>`;

  function renderNav() {
    const nuevos = S.turnos().filter((t) => t.estado === "nuevo" && t.fecha >= U.hoyISO()).length;
    const item = (v) => `<button class="${st.vista === v.id ? "is-active" : ""}" data-vista="${v.id}" aria-current="${st.vista === v.id ? "page" : "false"}">${I(v.icon)}<span>${v.label}</span>${v.id === "hoy" && nuevos ? `<span class="nav-badge" aria-label="${nuevos} nuevos">${nuevos}</span>` : ""}</button>`;
    $("#sideNav").innerHTML = VISTAS.map(item).join("");
    $("#bottomNav").innerHTML = VISTAS.map(item).join("");
    document.title = (nuevos ? `(${nuevos}) ` : "") + "Panel · Lumen Odontología";
  }

  function ir(v) { if (location.hash !== "#" + v) location.hash = v; else render(); }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-vista]"); if (b) ir(b.dataset.vista); });
  window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

  function render() {
    const h = location.hash.replace("#", "");
    st.vista = VISTAS.some((v) => v.id === h) ? h : "hoy";
    renderNav();
    ({ hoy: vHoy, agenda: vAgenda, pacientes: vPacientes, pagos: vPagos, ajustes: vAjustes })[st.vista]();
  }

  /* ================================================================== HOY */
  function fila(t, o) {
    o = o || {};
    const fin = U.toHHMM(U.toMin(t.hora) + Number(t.duracion));
    const activo = t.estado === "nuevo" || t.estado === "confirmado";
    const cls = t.estado === "cancelado" ? " is-cancel" : t.estado === "atendido" || t.estado === "ausente" ? " is-done" : "";
    const b = (act, label, ic, c) => `<button class="btn btn--xs ${c || ""}" data-act="${act}">${I(ic)}${label}</button>`;
    let acts = "";
    if (!o.sinAcciones) {
      if (activo) {
        acts = (t.estado === "nuevo" ? b("confirmar", "Confirmar", "check", "ok") : "")
          + b("atendido", "Atendido", "check", "ok") + b("ausente", "Ausente", "user") + b("cancelar", "Cancelar", "x", "bad")
          + b("recordatorio", t.recordatorio ? "Recordado ✓" : "Recordatorio", "wa", "wa");
      } else if (t.estado === "atendido" && !tienePago(t.id)) {
        acts = b("pago", "Registrar pago", "cash");
      }
    }
    return `<div class="trow${cls}" data-turno-id="${t.id}">
      <div class="trow-time"><b>${t.hora}</b><small>${o.conFecha ? diaCorto(t.fecha) : "a " + fin}</small></div>
      <div class="trow-info">
        <div class="trow-top"><span class="trow-name">${esc(t.paciente)}</span>${t.origen === "web" ? webTag : ""}${estadoTag(t.estado)}</div>
        <span class="trow-sub"><span class="pro-dot" style="background:${proColor(t.profesionalId)}"></span>${esc(t.tratamiento)} · ${esc(proCorto(t.profesionalId, t.profesional))}</span>
      </div>
      ${acts ? `<div class="trow-actions">${acts}</div>` : ""}
    </div>`;
  }

  function vHoy() {
    const hoy = U.hoyISO();
    const ts = S.turnos();
    const ahora = nowMin();
    const h = new Date().getHours();
    const saludo = h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
    // Accesos rápidos: botones chicos al lado de "Nuevo turno"
    const rapidos = `<button class="btn btn--sm btn--ghost" data-cmd="bloquear">${I("lock")}Bloquear horario</button>`
      + `<button class="btn btn--sm btn--ghost" data-cmd="cobro">${I("cash")}Registrar cobro</button>`
      + `<button class="btn btn--sm btn--ghost" data-cmd="agenda">${I("agenda")}Agenda</button>`;
    head("Panel · " + C.consultorio.nombre, `${saludo}, ${C.panel.usuario}`, U.fmtDiaLargo(hoy), rapidos + btnNuevo);

    const deHoy = ts.filter((t) => t.fecha === hoy).sort(byFH);
    const activosHoy = deHoy.filter((t) => t.estado !== "cancelado");
    const nuevos = ts.filter((t) => t.estado === "nuevo" && t.fecha >= hoy).sort(byFH);
    const fin = U.toISO(U.addDays(U.hoy(), 6));
    const conf = ts.filter((t) => t.estado === "confirmado" && t.fecha >= hoy && t.fecha <= fin).length;
    const cobrosHoy = S.pagos().filter((p) => p.fecha === hoy && p.estado !== "pendiente");
    const proximo = ts.filter((t) => (t.estado === "confirmado" || t.estado === "nuevo") && (t.fecha > hoy || (t.fecha === hoy && U.toMin(t.hora) + Number(t.duracion) > ahora))).sort(byFH)[0];
    const atendidos = deHoy.filter((t) => t.estado === "atendido").length;
    const activo = (t) => t.estado === "confirmado" || t.estado === "nuevo";
    const quedanHoy = deHoy.filter((t) => activo(t) && U.toMin(t.hora) + Number(t.duracion) > ahora).length;
    const proximos = ts.filter((t) => activo(t) && t.fecha > hoy).sort(byFH).slice(0, 5);

    const inbox = nuevos.length ? `
      <section class="inbox" aria-label="Turnos nuevos desde la web">
        <div class="inbox-head"><span class="blink" aria-hidden="true"></span><h2>Turnos nuevos desde la web</h2><span class="count">${nuevos.length}</span></div>
        <div class="inbox-list">${nuevos.map((t) => `
          <div class="inbox-item" data-turno-id="${t.id}">
            <div class="inbox-who"><span class="av">${esc(U.iniciales(t.paciente))}</span>
              <div><b>${esc(t.paciente)}</b><small>${esc(t.tratamiento)} · ${esc(cap(U.fmtDia(t.fecha)))} · ${t.hora} hs · ${esc(proCorto(t.profesionalId, t.profesional))}</small><small>${t.primeraVez ? "Primera vez · " : ""}${esc(t.obraSocial)} · pedido ${hace(t.creado)}</small></div>
            </div>
            <div class="inbox-actions">
              <button class="btn btn--sm btn--wa" data-act="confirmar">${I("wa")}Confirmar y avisar</button>
              <button class="btn btn--sm btn--ghost" data-act="rechazar">Rechazar / reprogramar</button>
            </div>
          </div>`).join("")}
        </div>
      </section>` : `<div class="inbox-empty">${I("check")}<span>No hay turnos nuevos para confirmar. Cuando alguien saque turno desde la web, aparece acá al instante.</span></div>`;

    // "Hoy · 16:30 hs", "Mañana · 10:00 hs" o "Lunes 19/10 · 10:00 hs"
    const cuandoLargo = (t) => {
      const n = U.diffDias(t.fecha);
      const dia = n === 0 ? "Hoy" : n === 1 ? "Mañana" : cap(U.fmtDia(t.fecha));
      return `${dia} · ${t.hora} hs`;
    };
    // "en 2 h 15 min", "en 3 días"
    const falta = (t) => {
      const [y, mo, d] = t.fecha.split("-").map(Number);
      const [hh, mm] = t.hora.split(":").map(Number);
      const min = Math.round((new Date(y, mo - 1, d, hh, mm) - new Date()) / 60000);
      if (min <= 0) return "ahora";
      if (min < 60) return `en ${min} min`;
      if (min < 24 * 60) { const h2 = Math.floor(min / 60), r = min % 60; return `en ${h2} h${r ? " " + r + " min" : ""}`; }
      const dd = U.diffDias(t.fecha);
      return `en ${dd} día${dd === 1 ? "" : "s"}`;
    };
    const proxHtml = proximo ? `
      <div class="next" data-turno-id="${proximo.id}">
        <span class="eyebrow">Próximo turno · ${esc(falta(proximo))}</span>
        <div class="next-time next-time--full">${esc(cuandoLargo(proximo))}</div>
        <div class="next-who"><b>${esc(proximo.paciente)}</b><span>${esc(proximo.tratamiento)} · ${esc(proCorto(proximo.profesionalId, proximo.profesional))} · ${proximo.duracion} min</span></div>
        <div class="next-actions">
          <button class="btn btn--sm btn--light" data-act="recordatorio">${I("wa")}Recordatorio</button>
          <button class="btn btn--sm btn--light" data-act="ver">Ver detalle</button>
        </div>
      </div>` : `<div class="card empty">${I("agenda")}<b>No hay turnos próximos</b></div>`;

    $("#view").innerHTML = `<div class="stack">
      ${tipDemo()}
      ${inbox}
      <div class="kpis">
        <div class="kpi"><small>Turnos de hoy</small><b>${activosHoy.length}</b><span>${atendidos} atendido${atendidos === 1 ? "" : "s"}</span></div>
        <div class="kpi${nuevos.length ? " kpi--warn" : ""}"><small>Nuevos sin confirmar</small><b>${nuevos.length}</b><span>desde la web</span></div>
        <div class="kpi"><small>Confirmados</small><b>${conf}</b><span>próximos 7 días</span></div>
        <div class="kpi kpi--accent"><small>Cobrado hoy</small><b>${moneyCorto(sum(cobrosHoy))}</b><span>${cobrosHoy.length} cobro${cobrosHoy.length === 1 ? "" : "s"}</span></div>
      </div>
      <div class="grid-2">
        <section class="card">
          <div class="card-head"><h2>Turnos de hoy</h2><span class="muted">${cap(U.fmtDia(hoy))}</span></div>
          ${deHoy.length ? `<div class="tlist">${deHoy.map((t) => fila(t)).join("")}</div>`
            : `<div class="empty">${I("hoy")}<b>Hoy no hay turnos</b><span>${S.rangosDelDia(hoy).length ? "El día está libre." : "El consultorio está cerrado."}</span></div>`}
          ${quedanHoy ? "" : `
            <div class="card-head" style="margin-top:22px"><h2>Próximos turnos</h2><span class="muted">${quedanHoy === 0 && deHoy.length ? "Hoy ya no quedan" : ""}</span></div>
            ${proximos.length ? `<div class="tlist">${proximos.map((t) => fila(t, { conFecha: true })).join("")}</div>` : `<div class="empty"><span>No hay turnos próximos.</span></div>`}`}
        </section>
        <aside class="sticky stack">
          ${proxHtml}
        </aside>
      </div>
    </div>`;
  }

  function tipDemo() {
    let ver = false;
    try { ver = sessionStorage.getItem(TIP) === "1"; } catch (e) {}
    if (!ver) return "";
    return `<div class="demo-tip" role="status">
      <span class="demo-tip-ico">${I("web")}</span>
      <p><b>Así lo ve la secretaria.</b> Sacá un turno desde la web y aparece acá al instante. Los datos de este demo se guardan solo en tu celu o compu: nadie más los ve.</p>
      <a class="btn btn--xs btn--ghost" href="index.html" target="_blank" rel="noopener">Abrir la web en otra pestaña</a>
      <button class="demo-tip-x" aria-label="Cerrar aviso"><svg><use href="#i-close"/></svg></button>
    </div>`;
  }
  document.addEventListener("click", (e) => {
    const x = e.target.closest(".demo-tip-x");
    if (!x) return;
    try { sessionStorage.removeItem(TIP); } catch (err) {}
    x.closest(".demo-tip").remove();
  });

  /* =============================================================== AGENDA */
  const PPM = 1.15; // píxeles por minuto en la vista semanal

  function vAgenda() {
    const dias = Array.from({ length: 7 }, (_, i) => U.toISO(U.addDays(st.semana, i)));
    const ts = S.turnos().filter((t) => t.estado !== "cancelado" && (st.pro === "todos" || t.profesionalId === st.pro));
    const bl = S.bloqueos().filter((b) => st.pro === "todos" || b.profesionalId === "todos" || b.profesionalId === st.pro);
    const visibles = dias.filter((d, i) => i < 6 || ts.some((t) => t.fecha === d) || S.rangosDelDia(d).length);
    if (!visibles.includes(st.dia)) st.dia = visibles.includes(U.hoyISO()) ? U.hoyISO() : visibles[0];

    const a = U.parseISO(dias[0]), b = U.parseISO(dias[5]);
    const rango = a.getMonth() === b.getMonth()
      ? `${a.getDate()} al ${b.getDate()} de ${U.MESES[a.getMonth()]}`
      : `${a.getDate()} de ${U.MESES[a.getMonth()].slice(0, 3)} al ${b.getDate()} de ${U.MESES[b.getMonth()].slice(0, 3)}`;
    head("Agenda", "Agenda", `Semana del ${rango}`, `<button class="btn btn--ghost" data-cmd="bloquear">${I("lock")}Bloquear horario</button>${btnNuevo}`);

    const proPills = [{ id: "todos", corto: "Todos" }].concat(C.profesionales)
      .map((p) => `<button class="pill${st.pro === p.id ? " is-active" : ""}" data-pro="${p.id}">${p.id !== "todos" ? `<span class="pro-dot" style="background:${proColor(p.id)};margin:0"></span>` : ""}${esc(p.corto)}</button>`).join("");
    const esEstaSemana = lunes(U.hoy()).getTime() === st.semana.getTime();

    $("#view").innerHTML = `
      <div class="toolbar">
        <div class="week-nav">
          <button class="icon-btn" data-week="-1" aria-label="Semana anterior">${I("back")}</button>
          <button class="icon-btn" data-week="1" aria-label="Semana siguiente">${I("next")}</button>
          ${esEstaSemana ? "" : `<button class="pill" data-week="0">Hoy</button>`}
        </div>
        <div class="pills" role="group" aria-label="Filtrar por profesional">${proPills}</div>
      </div>
      <div class="week">${semanaHTML(visibles, ts, bl)}</div>
      <div class="daylist">${diaHTML(visibles, ts, bl)}</div>
      <div class="legend">
        ${C.profesionales.map((p) => `<span><i style="background:${proColor(p.id)}"></i>${esc(p.corto)}</span>`).join("")}
        <span><i style="background:var(--warn-bg);outline:1.5px dashed var(--warn);outline-offset:-1.5px"></i>Nuevo sin confirmar</span>
        <span><i style="background:repeating-linear-gradient(-45deg,var(--muted-bg) 0 4px,#F6F3F0 4px 8px)"></i>Bloqueado</span>
        <span class="hide-sm">Tocá un espacio libre para cargar un turno.</span>
      </div>`;

    $$("[data-week]").forEach((btn) => btn.addEventListener("click", () => {
      const n = Number(btn.dataset.week);
      st.semana = n === 0 ? lunes(U.hoy()) : U.addDays(st.semana, 7 * n);
      st.dia = n === 0 ? U.hoyISO() : U.toISO(st.semana);
      vAgenda();
    }));
    $$("[data-pro]").forEach((btn) => btn.addEventListener("click", () => { st.pro = btn.dataset.pro; vAgenda(); }));
    $$("[data-dia]").forEach((btn) => btn.addEventListener("click", () => { st.dia = btn.dataset.dia; vAgenda(); }));
    $$("[data-bloqueo]").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); verBloqueo(el.dataset.bloqueo); }));
    $$(".wcol").forEach((col) => col.addEventListener("click", (e) => {
      if (e.target !== col) return;
      const r = col.getBoundingClientRect();
      const step = S.ajustes().intervalo;
      const m = Math.floor((Number(col.dataset.min0) + (e.clientY - r.top) / PPM) / step) * step;
      const lanes = st.pro === "todos" ? C.profesionales : [S.profesional(st.pro)];
      const lane = lanes[Math.min(lanes.length - 1, Math.floor(((e.clientX - r.left) / r.width) * lanes.length))];
      abrirNuevoTurno({ fecha: col.dataset.fecha, hora: U.toHHMM(m), profesionalId: lane.id });
    }));
  }

  function limitesHorario(visibles, ts) {
    const aj = S.ajustes();
    let min = 24 * 60, max = 0;
    Object.values(aj.horarios).forEach((rs) => rs.forEach(([a, b]) => { min = Math.min(min, U.toMin(a)); max = Math.max(max, U.toMin(b)); }));
    ts.filter((t) => visibles.includes(t.fecha)).forEach((t) => { min = Math.min(min, U.toMin(t.hora)); max = Math.max(max, U.toMin(t.hora) + Number(t.duracion)); });
    if (min >= max) { min = 9 * 60; max = 20 * 60; }
    return [Math.floor(min / 60) * 60, Math.ceil(max / 60) * 60];
  }

  function semanaHTML(visibles, ts, bl) {
    const [m0, m1] = limitesHorario(visibles, ts);
    const H = (m1 - m0) * PPM;
    const hoy = U.hoyISO();
    const lanes = st.pro === "todos" ? C.profesionales.map((p) => p.id) : [st.pro];
    const n = lanes.length;
    const pos = (ini, fin) => `top:${(ini - m0) * PPM}px;height:${Math.max(18, (fin - ini) * PPM - 3)}px`;
    const laneCss = (proId) => {
      if (proId === "todos" || n === 1) return "left:3px;right:3px";
      const i = Math.max(0, lanes.indexOf(proId));
      return `left:calc(${(i * 100) / n}% + 3px);width:calc(${100 / n}% - 6px)`;
    };
    let headHtml = `<div class="wh"></div>`;
    let bodyHtml = `<div class="gutter" style="height:${H}px">`;
    for (let m = m0; m < m1; m += 60) bodyHtml += `<span style="top:${(m - m0) * PPM}px">${U.toHHMM(m)}</span>`;
    bodyHtml += `</div>`;
    visibles.forEach((d) => {
      const f = U.parseISO(d);
      const fer = S.feriado(d);
      const delDia = ts.filter((t) => t.fecha === d).sort(byFH);
      headHtml += `<div class="wh${d === hoy ? " is-today" : ""}"><b>${U.DIAS_CORTO[f.getDay()]} ${f.getDate()}</b><small>${delDia.length} turno${delDia.length === 1 ? "" : "s"}</small>${fer ? `<span class="fer">${esc(fer.nombre)}</span>` : ""}</div>`;
      // Zonas cerradas
      let cerr = "";
      let cursor = m0;
      S.rangosDelDia(d).map(([a, b]) => [U.toMin(a), U.toMin(b)]).sort((x, y) => x[0] - y[0]).forEach(([a, b]) => {
        if (a > cursor) cerr += `<div class="closed" style="top:${(cursor - m0) * PPM}px;height:${(a - cursor) * PPM}px"></div>`;
        cursor = Math.max(cursor, b);
      });
      if (cursor < m1) cerr += `<div class="closed" style="top:${(cursor - m0) * PPM}px;height:${(m1 - cursor) * PPM}px"></div>`;
      const ahora = nowMin();
      const now = d === hoy && ahora > m0 && ahora < m1 ? `<div class="now-line" style="top:${(ahora - m0) * PPM}px"></div>` : "";
      const bloques = bl.filter((x) => x.fecha === d).map((x) => {
        const ini = Math.max(m0, U.toMin(x.desde)), fin = Math.min(m1, U.toMin(x.hasta));
        return `<div class="blk-lock" data-bloqueo="${x.id}" style="${pos(ini, fin)};${laneCss(x.profesionalId)}"><b>${esc(x.motivo || "Bloqueado")}</b>${x.profesionalId === "todos" ? "Todo el equipo" : esc(proCorto(x.profesionalId))}</div>`;
      }).join("");
      const turnos = delDia.map((t) => {
        const ini = U.toMin(t.hora), fin = ini + Number(t.duracion);
        const c = proColor(t.profesionalId);
        return `<button class="blk is-${t.estado}" data-turno-id="${t.id}" style="${pos(ini, fin)};${laneCss(t.profesionalId)};--c:${c};--c-bg:color-mix(in srgb, ${c} 16%, white)" title="${esc(t.hora + " · " + t.paciente + " · " + t.tratamiento)}">
          <b>${t.hora} ${esc(t.paciente)}</b><span>${esc(t.tratamiento)}</span></button>`;
      }).join("");
      const media = 30 * PPM;
      const lines = `background-image:repeating-linear-gradient(to bottom, var(--borde) 0 1px, transparent 1px ${media}px, rgba(227, 214, 198, .5) ${media}px ${media + 1}px, transparent ${media + 1}px ${60 * PPM}px)`;
      bodyHtml += `<div class="wcol${d === hoy ? " is-today" : ""}" data-fecha="${d}" data-min0="${m0}" style="height:${H}px;${lines}">${cerr}${now}${bloques}${turnos}</div>`;
    });
    return `<div class="week-scroll"><div class="week-grid" style="grid-template-columns:56px repeat(${visibles.length}, minmax(110px, 1fr))">${headHtml}${bodyHtml}</div></div>`;
  }

  function diaHTML(visibles, ts, bl) {
    const hoy = U.hoyISO();
    const strip = visibles.map((d) => {
      const f = U.parseISO(d);
      const n = ts.filter((t) => t.fecha === d).length;
      return `<button class="${d === st.dia ? "is-active" : ""}${d === hoy ? " is-today" : ""}" data-dia="${d}"><small>${U.DIAS_CORTO[f.getDay()]}</small><b>${f.getDate()}</b><i>${S.feriado(d) ? "feriado" : n ? n + " t." : "—"}</i></button>`;
    }).join("");
    const items = ts.filter((t) => t.fecha === st.dia).map((t) => ({ k: t.hora, html: fila(t, { sinAcciones: true }) }))
      .concat(bl.filter((b) => b.fecha === st.dia).map((b) => ({ k: b.desde, html: `<div class="lock-row" data-bloqueo="${b.id}">${I("lock")}<span><b>${b.desde}–${b.hasta}</b> · ${esc(b.motivo || "Bloqueado")} · ${b.profesionalId === "todos" ? "Todo el equipo" : esc(proCorto(b.profesionalId))}</span></div>` })))
      .sort((x, y) => x.k.localeCompare(y.k));
    const abierto = S.rangosDelDia(st.dia).length > 0;
    return `<div class="daystrip">${strip}</div>
      <section class="card">
        <div class="card-head"><h2>${esc(cap(U.fmtDiaLargo(st.dia)))}</h2></div>
        ${items.length ? `<div class="tlist">${items.map((x) => x.html).join("")}</div>`
          : `<div class="empty">${I("agenda")}<b>${abierto ? "Sin turnos este día" : "Cerrado"}</b>${abierto ? `<button class="btn btn--sm" data-nuevo-dia="${st.dia}">${I("plus")}Cargar turno</button>` : ""}</div>`}
      </section>`;
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-nuevo-dia]"); if (b) abrirNuevoTurno({ fecha: b.dataset.nuevoDia }); });

  function verBloqueo(id) {
    const b = S.bloqueos().find((x) => x.id === id);
    if (!b) return;
    const m = modal({
      title: b.motivo || "Horario bloqueado", size: "sm",
      sub: `${esc(cap(U.fmtDiaLargo(b.fecha)))} · ${b.desde} a ${b.hasta}`,
      body: `<p class="muted">${b.profesionalId === "todos" ? "Bloqueado para todo el equipo." : "Bloqueado para " + esc(S.profesional(b.profesionalId).nombre) + "."} En la web no se ofrecen turnos en este horario.</p>`,
      foot: `<button class="btn btn--ghost" data-close>Cerrar</button><button class="btn btn--danger" data-del>${I("trash")}Desbloquear</button>`
    });
    $("[data-close]", m).addEventListener("click", m.close);
    $("[data-del]", m).addEventListener("click", () => { S.eliminarBloqueo(id); m.close(); toast("Horario desbloqueado"); });
  }

  /* ======================================================= DETALLE TURNO */
  function abrirTurno(id) {
    const m = modal({ title: "Turno", size: "lg" });
    m.modo = "ver";
    pintarTurno(m, id);
    return m;
  }

  function pintarTurno(m, id) {
    const t = S.turno(id);
    if (!t) { m.close(); return; }
    const p = S.profesional(t.profesionalId);
    const pagosT = S.pagos().filter((x) => x.turnoId === t.id);
    const tr = S.tratamiento(t.tratamientoId);
    m.setHead(t.paciente, `${esc(t.codigo)} · ${t.origen === "web" ? "Sacado desde la web" : "Cargado a mano"} · ${hace(t.creado)}`);
    const activo = t.estado === "nuevo" || t.estado === "confirmado";

    let reprog = "";
    if (m.modo === "reprogramar") {
      reprog = `<div class="subcard" id="reprog">
        <p class="section-label">Reprogramar turno</p>
        <div class="form">
          <div class="row">
            <div class="field"><label for="rp-fecha">Nuevo día</label><input class="input" type="date" id="rp-fecha" min="${U.hoyISO()}" value="${m.rpFecha || t.fecha}"></div>
            <div class="field"><label for="rp-pro">Profesional</label><select class="select" id="rp-pro">${S.profesionalesPara(t.tratamientoId).map((x) => `<option value="${x.id}"${(m.rpPro || t.profesionalId) === x.id ? " selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select></div>
          </div>
          <div class="field"><span class="field-label">Horarios libres</span><div class="slot-pills" id="rp-slots"></div></div>
        </div>
        <div class="actions"><button class="btn btn--ghost btn--sm" data-rp="cancel">Volver</button><button class="btn btn--sm" data-rp="save" disabled>Guardar nuevo horario</button></div>
      </div>`;
    }

    m.body.innerHTML = `
      ${m.aviso ? `<div class="note-ok">${m.aviso}</div>` : ""}
      <div class="info">
        <div><small>Tratamiento</small><span>${esc(t.tratamiento)}</span></div>
        <div><small>Profesional</small><span><span class="pro-dot" style="background:${proColor(t.profesionalId)}"></span>${esc(p ? p.nombre : t.profesional)}</span></div>
        <div><small>Día</small><span>${esc(cap(U.fmtDiaLargo(t.fecha)))}</span></div>
        <div><small>Hora</small><span>${t.hora} a ${U.toHHMM(U.toMin(t.hora) + Number(t.duracion))} hs · ${t.duracion} min</span></div>
        <div><small>WhatsApp</small><a href="${waPaciente(t)}" target="_blank" rel="noopener">${esc(U.telVisible(t.whatsapp))}</a></div>
        <div><small>Email</small><span>${t.email ? esc(t.email) : "—"}</span></div>
        <div><small>Obra social</small><span>${esc(t.obraSocial || "—")}</span></div>
        <div><small>Primera vez</small><span>${t.primeraVez ? "Sí" : "No"}</span></div>
        <div class="full"><small>Comentario</small><span>${t.comentario ? esc(t.comentario) : "—"}</span></div>
        ${t.motivo ? `<div class="full"><small>Nota</small><span>${esc(t.motivo)}</span></div>` : ""}
      </div>
      <p class="section-label">Estado</p>
      <div class="estados" role="group" aria-label="Estado del turno">${Object.keys(ESTADOS).map((e) => `<button class="${t.estado === e ? "is-active" : ""}" data-e="${e}" aria-pressed="${t.estado === e}">${ESTADOS[e]}</button>`).join("")}</div>
      ${reprog}
      <p class="section-label">WhatsApp al paciente</p>
      <div class="actions">
        ${t.estado === "nuevo" ? `<button class="btn btn--sm btn--wa" data-x="confirmar">${I("wa")}Confirmar y avisar</button>` : ""}
        ${activo ? `<button class="btn btn--sm btn--ghost" data-x="recordatorio">${I("bell")}Enviar recordatorio${t.recordatorio ? " (ya enviado)" : ""}</button>` : ""}
        <a class="btn btn--sm btn--ghost" href="${waPaciente(t)}" target="_blank" rel="noopener">${I("wa")}Escribirle</a>
      </div>
      <p class="section-label">Pagos de este turno</p>
      <div class="subcard">
        ${pagosT.length ? `<div class="hist">${pagosT.map((x) => `<div class="hist-row" data-pago="${x.id}"><b>${U.money(x.monto)} · ${esc(x.medio || "sin medio")}</b><small>${fechaCorta(x.fecha)}</small>${pagoTag(x.estado)}</div>`).join("")}</div>` : `<p class="muted" style="font-size:14px">Sin pagos registrados${tr ? ` · Precio de referencia ${U.money(tr.precio)}` : ""}.</p>`}
        <div><button class="btn btn--sm" data-x="pago">${I("cash")}Registrar pago</button></div>
      </div>`;

    m.setFoot(`
      <button class="btn btn--ghost" data-x="ficha">${I("user")}Ficha del paciente</button>
      ${activo ? `<button class="btn btn--ghost" data-x="reprogramar">${I("agenda")}Reprogramar</button>` : ""}
      ${t.estado !== "cancelado" ? `<button class="btn btn--danger" data-x="cancelar">${I("x")}Cancelar turno</button>` : ""}`);

    $$("[data-e]", m.body).forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.e === t.estado) return;
      S.actualizarTurno(t.id, { estado: b.dataset.e });
      m.aviso = `Estado cambiado a <b>${ESTADOS[b.dataset.e]}</b>.`;
      pintarTurno(m, id);
    }));
    $$("[data-pago]", m.body).forEach((r) => r.addEventListener("click", () => abrirCobro({ pagoId: r.dataset.pago, onSave: () => pintarTurno(m, id) })));
    const on = (k, fn) => { $$(`[data-x="${k}"]`, m).forEach((b) => b.addEventListener("click", fn)); };
    on("confirmar", () => { acciones.confirmar(t); m.aviso = "Confirmado. Se abrió WhatsApp con el mensaje para el paciente."; pintarTurno(m, id); });
    on("recordatorio", () => { acciones.recordatorio(t); m.aviso = "Se abrió WhatsApp con el recordatorio para el paciente."; pintarTurno(m, id); });
    on("pago", () => abrirCobro({ turnoId: t.id, onSave: () => pintarTurno(m, id) }));
    on("ficha", () => { m.close(); abrirPaciente(t.pacienteId); });
    on("reprogramar", () => { m.modo = "reprogramar"; m.aviso = ""; pintarTurno(m, id); $("#reprog").scrollIntoView({ block: "nearest" }); });
    on("cancelar", () => acciones.cancelar(t).then((ok) => { if (ok) { m.aviso = "Turno cancelado. El horario quedó libre."; pintarTurno(m, id); } }));

    if (m.modo === "reprogramar") montarReprogramar(m, t);
  }

  function montarReprogramar(m, t) {
    const fecha = $("#rp-fecha", m), pro = $("#rp-pro", m), slots = $("#rp-slots", m), save = $('[data-rp="save"]', m);
    let hora = null;
    const pintar = () => {
      hora = null; save.disabled = true;
      m.rpFecha = fecha.value; m.rpPro = pro.value;
      if (!fecha.value) { slots.innerHTML = `<span class="muted">Elegí un día.</span>`; return; }
      const libres = S.horariosLibres(fecha.value, t.tratamientoId, pro.value, { excluir: t.id, margen: 0 });
      slots.innerHTML = libres.length ? libres.map((h) => `<button type="button" data-h="${h.hora}">${h.hora}</button>`).join("")
        : `<span class="muted" style="font-size:14px">${S.rangosDelDia(fecha.value).length ? "No quedan horarios libres ese día." : "Ese día el consultorio está cerrado."}</span>`;
      $$("[data-h]", slots).forEach((b) => b.addEventListener("click", () => {
        hora = b.dataset.h; save.disabled = false;
        $$("[data-h]", slots).forEach((x) => x.classList.toggle("is-active", x === b));
      }));
    };
    fecha.addEventListener("change", pintar);
    pro.addEventListener("change", pintar);
    pintar();
    $('[data-rp="cancel"]', m).addEventListener("click", () => { m.modo = "ver"; pintarTurno(m, t.id); });
    save.addEventListener("click", () => {
      if (!hora) return;
      const p = S.profesional(pro.value);
      const nuevo = S.actualizarTurno(t.id, { fecha: fecha.value, hora, profesionalId: p.id, profesional: p.nombre, estado: "confirmado", recordatorio: null });
      m.modo = "ver";
      m.aviso = `Turno movido al ${esc(U.fmtDia(nuevo.fecha))} a las ${hora} hs. <button class="link-btn" id="rpAvisar">Avisar al paciente por WhatsApp</button>`;
      pintarTurno(m, t.id);
      $("#rpAvisar", m).addEventListener("click", () => abrirWA(nuevo.whatsapp, S.mensaje("confirmacion", nuevo)));
      toast("Turno reprogramado");
    });
  }

  /* ========================================================= NUEVO TURNO */
  function abrirNuevoTurno(pre) {
    pre = pre || {};
    const pacs = S.pacientes().slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
    const trats = S.tratamientos();
    const m = modal({
      title: "Nuevo turno",
      sub: "Para pacientes que llaman por teléfono o escriben por WhatsApp.",
      size: "lg",
      body: `<form class="form" id="ntForm" novalidate>
        <div class="field"><label for="nt-pac">Paciente</label>
          <select class="select" id="nt-pac"><option value="__nuevo">+ Paciente nuevo</option>${pacs.map((p) => `<option value="${p.id}"${pre.pacienteId === p.id ? " selected" : ""}>${esc(p.nombre)} · ${esc(p.obraSocial)}</option>`).join("")}</select>
        </div>
        <div class="subcard" id="nt-nuevo">
          <div class="row">
            <div class="field" data-f="nombre"><label for="nt-nombre">Nombre y apellido</label><input class="input" id="nt-nombre" autocomplete="off"><span class="field-error"></span></div>
            <div class="field" data-f="whatsapp"><label for="nt-wa">WhatsApp</label><input class="input" id="nt-wa" type="tel" inputmode="tel" placeholder="291 412 3456"><span class="field-error"></span></div>
          </div>
          <div class="field"><label for="nt-os">Obra social</label><select class="select" id="nt-os">${C.obrasSociales.map((o) => `<option${o === "Particular" ? " selected" : ""}>${esc(o)}</option>`).join("")}<option>Otra</option></select></div>
        </div>
        <div class="row">
          <div class="field"><label for="nt-trat">Tratamiento</label><select class="select" id="nt-trat">${trats.map((t) => `<option value="${t.id}"${(pre.tratamientoId || "consulta") === t.id ? " selected" : ""}>${esc(t.nombre)} · ${t.duracion} min</option>`).join("")}</select></div>
          <div class="field"><label for="nt-pro">Profesional</label><select class="select" id="nt-pro"></select></div>
        </div>
        <div class="field"><label for="nt-fecha">Día</label><input class="input" type="date" id="nt-fecha" value="${pre.fecha || U.hoyISO()}"></div>
        <div class="field" data-f="hora"><span class="field-label">Horario</span><div class="slot-pills" id="nt-slots"></div><span class="field-error"></span></div>
        <div class="row">
          <div class="field"><label class="switch"><input type="checkbox" id="nt-pv"><i></i>Primera vez</label></div>
          <div class="field"><label class="switch"><input type="checkbox" id="nt-avisar" checked><i></i>Avisarle por WhatsApp al guardar</label></div>
        </div>
        <div class="field"><label for="nt-com">Comentario <span class="opt">(opcional)</span></label><textarea class="textarea" id="nt-com" rows="2"></textarea></div>
      </form>`,
      foot: `<button class="btn btn--ghost" data-close>Cancelar</button><button class="btn" data-save>${I("check")}Guardar turno</button>`
    });
    const f = (id) => $("#" + id, m);
    let hora = pre.hora || null;

    const pintarPac = () => { f("nt-nuevo").hidden = f("nt-pac").value !== "__nuevo"; };
    const pintarPros = () => {
      const ps = S.profesionalesPara(f("nt-trat").value);
      const actual = f("nt-pro").value || pre.profesionalId;
      f("nt-pro").innerHTML = ps.map((p) => `<option value="${p.id}"${actual === p.id ? " selected" : ""}>${esc(p.nombre)}</option>`).join("");
    };
    const pintarSlots = () => {
      const fecha = f("nt-fecha").value;
      const box = f("nt-slots");
      if (!fecha) { box.innerHTML = `<span class="muted">Elegí un día.</span>`; hora = null; return; }
      const libres = S.horariosLibres(fecha, f("nt-trat").value, f("nt-pro").value, { margen: 0 });
      if (hora && !libres.some((h) => h.hora === hora)) hora = null;
      box.innerHTML = libres.length ? libres.map((h) => `<button type="button" class="${h.hora === hora ? "is-active" : ""}" data-h="${h.hora}">${h.hora}</button>`).join("")
        : `<span class="muted" style="font-size:14px">${S.feriado(fecha) ? "Feriado: " + esc(S.feriado(fecha).nombre) + "." : S.rangosDelDia(fecha).length ? "No quedan horarios libres ese día con este profesional." : "Ese día el consultorio está cerrado."}</span>`;
      $$("[data-h]", box).forEach((b) => b.addEventListener("click", () => {
        hora = b.dataset.h;
        $$("[data-h]", box).forEach((x) => x.classList.toggle("is-active", x === b));
        $('[data-f="hora"]', m).classList.remove("has-error");
      }));
    };
    f("nt-pac").addEventListener("change", pintarPac);
    f("nt-trat").addEventListener("change", () => { pintarPros(); pintarSlots(); });
    f("nt-pro").addEventListener("change", pintarSlots);
    f("nt-fecha").addEventListener("change", pintarSlots);
    pintarPac(); pintarPros(); pintarSlots();

    $("[data-close]", m).addEventListener("click", m.close);
    $("[data-save]", m).addEventListener("click", () => {
      const err = (k, msg) => { const fd = $(`[data-f="${k}"]`, m); fd.classList.add("has-error"); $(".field-error", fd).textContent = msg; };
      $$(".has-error", m).forEach((x) => x.classList.remove("has-error"));
      let pac = null, ok = true;
      if (f("nt-pac").value === "__nuevo") {
        const nombre = f("nt-nombre").value.trim();
        const tel = f("nt-wa").value.replace(/\D/g, "");
        if (nombre.split(/\s+/).length < 2) { err("nombre", "Nombre y apellido."); ok = false; }
        if (tel.length < 10) { err("whatsapp", "Con código de área (ej: 291 412 3456)."); ok = false; }
        pac = { nombre, whatsapp: tel, email: "", obraSocial: f("nt-os").value };
      } else {
        pac = S.paciente(f("nt-pac").value);
      }
      if (!hora) { err("hora", "Elegí un horario."); ok = false; }
      if (!ok) return;
      const t = S.tratamiento(f("nt-trat").value);
      const p = S.profesional(f("nt-pro").value);
      const turno = S.crearTurno({
        origen: "manual", estado: "confirmado",
        paciente: pac.nombre, whatsapp: pac.whatsapp, email: pac.email || "", obraSocial: pac.obraSocial,
        primeraVez: f("nt-pv").checked, tratamientoId: t.id, tratamiento: t.nombre, profesionalId: p.id, profesional: p.nombre,
        fecha: f("nt-fecha").value, hora, duracion: t.duracion, comentario: f("nt-com").value.trim()
      });
      if (f("nt-avisar").checked) abrirWA(turno.whatsapp, S.mensaje("confirmacion", turno));
      m.close();
      toast(`Turno cargado: ${U.primerNombre(turno.paciente)} · ${diaCorto(turno.fecha)} ${turno.hora}`, { label: "Ver", fn: () => abrirTurno(turno.id) });
    });
  }

  /* ===================================================== BLOQUEAR HORARIO */
  function abrirBloqueo(pre) {
    pre = pre || {};
    const m = modal({
      title: "Bloquear horario",
      sub: "Vacaciones, almuerzo, capacitación… En la web no se van a ofrecer turnos en ese horario.",
      body: `<form class="form" novalidate>
        <div class="field"><label for="bq-pro">¿Para quién?</label><select class="select" id="bq-pro"><option value="todos">Todo el equipo</option>${C.profesionales.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}</select></div>
        <div class="row">
          <div class="field"><label for="bq-desde">Desde el día</label><input class="input" type="date" id="bq-desde" value="${pre.fecha || U.hoyISO()}" min="${U.hoyISO()}"></div>
          <div class="field"><label for="bq-hasta">Hasta el día <span class="opt">(para varios días)</span></label><input class="input" type="date" id="bq-hasta" min="${U.hoyISO()}"></div>
        </div>
        <label class="switch"><input type="checkbox" id="bq-todo"><i></i>Todo el día</label>
        <div class="row" id="bq-horas">
          <div class="field"><label for="bq-h1">Desde</label><input class="input" type="time" id="bq-h1" value="13:00" step="900"></div>
          <div class="field"><label for="bq-h2">Hasta</label><input class="input" type="time" id="bq-h2" value="14:00" step="900"></div>
        </div>
        <div class="field"><label for="bq-mot">Motivo</label><select class="select" id="bq-mot"><option>Almuerzo</option><option>Vacaciones</option><option>Capacitación / congreso</option><option>Trámite personal</option><option>Mantenimiento</option><option>Otro</option></select></div>
        <div class="field-error" id="bq-err" style="display:block"></div>
      </form>
      <div id="bq-list"></div>`,
      foot: `<button class="btn btn--ghost" data-close>Cancelar</button><button class="btn" data-save>${I("lock")}Bloquear</button>`
    });
    const f = (id) => $("#" + id, m);
    const pintarLista = () => {
      const prox = S.bloqueos().filter((b) => b.fecha >= U.hoyISO()).sort((a, b) => (a.fecha + a.desde).localeCompare(b.fecha + b.desde));
      f("bq-list").innerHTML = prox.length ? `<p class="section-label" style="margin-bottom:8px">Bloqueos próximos</p><div class="subcard"><div class="hist">${prox.map((b) => `
        <div class="hist-row" style="cursor:default"><b>${esc(cap(U.fmtDia(b.fecha)))} · ${b.desde}–${b.hasta}</b><small>${esc(b.motivo)} · ${b.profesionalId === "todos" ? "Todo el equipo" : esc(proCorto(b.profesionalId))}</small>
        <button class="btn btn--xs btn--ghost" data-del="${b.id}" style="grid-column:2;grid-row:1/span 2">${I("trash")}Quitar</button></div>`).join("")}</div></div>` : "";
      $$("[data-del]", m).forEach((b) => b.addEventListener("click", () => { S.eliminarBloqueo(b.dataset.del); pintarLista(); toast("Bloqueo eliminado"); }));
    };
    pintarLista();
    f("bq-todo").addEventListener("change", () => { f("bq-horas").style.display = f("bq-todo").checked ? "none" : ""; });
    f("bq-mot").addEventListener("change", () => { if (f("bq-mot").value === "Vacaciones") { f("bq-todo").checked = true; f("bq-horas").style.display = "none"; } });
    $("[data-close]", m).addEventListener("click", m.close);
    $("[data-save]", m).addEventListener("click", () => {
      const desde = f("bq-desde").value, hasta = f("bq-hasta").value || desde;
      const todo = f("bq-todo").checked;
      const h1 = todo ? "00:00" : f("bq-h1").value, h2 = todo ? "23:59" : f("bq-h2").value;
      if (!desde) { f("bq-err").textContent = "Elegí el día."; return; }
      if (hasta < desde) { f("bq-err").textContent = "El día final no puede ser antes del inicial."; return; }
      if (!todo && (!h1 || !h2 || h2 <= h1)) { f("bq-err").textContent = "Revisá el horario: “hasta” tiene que ser después de “desde”."; return; }
      let creados = 0, choques = 0;
      for (let d = U.parseISO(desde); U.toISO(d) <= hasta; d = U.addDays(d, 1)) {
        const iso = U.toISO(d);
        if (!S.rangosDelDia(iso).length) continue;
        S.crearBloqueo({ fecha: iso, desde: h1, hasta: h2, profesionalId: f("bq-pro").value, motivo: f("bq-mot").value });
        creados++;
        choques += S.turnos().filter((t) => t.fecha === iso && (t.estado === "nuevo" || t.estado === "confirmado") && (f("bq-pro").value === "todos" || t.profesionalId === f("bq-pro").value)
          && U.toMin(t.hora) < U.toMin(h2) && U.toMin(t.hora) + Number(t.duracion) > U.toMin(h1)).length;
      }
      if (!creados) { f("bq-err").textContent = "Esos días el consultorio ya está cerrado."; return; }
      m.close();
      toast(`Horario bloqueado${creados > 1 ? ` (${creados} días)` : ""}${choques ? ` · Ojo: hay ${choques} turno${choques > 1 ? "s" : ""} en ese horario` : ""}`);
    });
  }

  /* ============================================================ PACIENTES */
  function statsPacientes() {
    const hoy = U.hoyISO();
    const map = {};
    S.turnos().forEach((t) => {
      const s = map[t.pacienteId] || (map[t.pacienteId] = { visitas: 0, ultimo: null, proximo: null, total: 0 });
      s.total++;
      if (t.estado === "atendido") s.visitas++;
      if (t.estado === "cancelado") return;
      if (t.fecha <= hoy && (!s.ultimo || t.fecha > s.ultimo.fecha)) s.ultimo = t;
      if (t.fecha > hoy && (!s.proximo || t.fecha < s.proximo.fecha)) s.proximo = t;
    });
    return map;
  }

  function vPacientes() {
    const n = S.pacientes().length;
    head("Pacientes", "Pacientes", `${n} pacientes en la base`, btnNuevo);
    $("#view").innerHTML = `<section class="card">
      <div class="toolbar">
        <label class="search"><span class="sr-only">Buscar paciente</span>${I("search")}<input class="input" id="q" type="search" placeholder="Buscar por nombre, WhatsApp u obra social" value="${esc(st.q)}" autocomplete="off"></label>
        <span class="muted" id="qCount"></span>
      </div>
      <div id="pacTabla"></div>
    </section>`;
    const q = $("#q");
    q.addEventListener("input", () => { st.q = q.value; tablaPacientes(); });
    tablaPacientes();
  }

  function tablaPacientes() {
    const stats = statsPacientes();
    const q = norm(st.q).trim();
    const qd = st.q.replace(/\D/g, "");
    const lista = S.pacientes()
      .filter((p) => !q || norm(p.nombre).includes(q) || norm(p.obraSocial).includes(q) || (qd.length > 2 && p.whatsapp.includes(qd)))
      .sort((a, b) => {
        const fa = (stats[a.id] && stats[a.id].ultimo && stats[a.id].ultimo.fecha) || "", fb = (stats[b.id] && stats[b.id].ultimo && stats[b.id].ultimo.fecha) || "";
        return fb.localeCompare(fa) || a.nombre.localeCompare(b.nombre);
      });
    $("#qCount").textContent = q ? `${lista.length} resultado${lista.length === 1 ? "" : "s"}` : "";
    $("#pacTabla").innerHTML = lista.length ? `<table class="table">
      <thead><tr><th>Paciente</th><th>WhatsApp</th><th>Obra social</th><th class="num">Visitas</th><th>Último turno</th><th>Próximo</th></tr></thead>
      <tbody>${lista.map((p) => {
        const s = stats[p.id] || { visitas: 0 };
        return `<tr data-pac="${p.id}">
          <td><div class="who"><span class="av">${esc(U.iniciales(p.nombre))}</span><div><b>${esc(p.nombre)}</b><small>${esc(p.obraSocial)}</small></div></div></td>
          <td class="hide-sm">${esc(U.telVisible(p.whatsapp))}</td>
          <td class="hide-sm">${esc(p.obraSocial)}</td>
          <td class="num right">${s.visitas} visita${s.visitas === 1 ? "" : "s"}</td>
          <td class="sub" data-l="Último">${s.ultimo ? `${fechaCorta(s.ultimo.fecha)} · ${esc(s.ultimo.tratamiento)}` : "—"}</td>
          <td class="sub" data-l="Próximo">${s.proximo ? `${diaCorto(s.proximo.fecha)} ${s.proximo.hora}` : "—"}</td>
        </tr>`;
      }).join("")}</tbody></table>` : `<div class="empty">${I("search")}<b>No encontramos pacientes</b><span>Probá con otro nombre o número.</span></div>`;
    $$("[data-pac]").forEach((r) => r.addEventListener("click", () => abrirPaciente(r.dataset.pac)));
  }

  function abrirPaciente(id) {
    const p = S.paciente(id);
    if (!p) return;
    const m = modal({ title: p.nombre, size: "lg" });
    pintarPaciente(m, id);
  }

  function pintarPaciente(m, id) {
    const p = S.paciente(id);
    const ts = S.turnos().filter((t) => t.pacienteId === id).sort(byFH).reverse();
    const pg = S.pagos().filter((x) => x.pacienteId === id);
    const visitas = ts.filter((t) => t.estado === "atendido");
    const tratamientos = Array.from(new Set(visitas.map((t) => t.tratamiento)));
    m.setHead(p.nombre, `Paciente desde ${U.MESES[new Date(p.creado).getMonth()]} ${new Date(p.creado).getFullYear()}`);
    m.body.innerHTML = `
      <div class="ficha-head">
        <span class="av av--lg">${esc(U.iniciales(p.nombre))}</span>
        <div class="chips"><span class="chip chip--wood">${esc(p.obraSocial)}</span><span class="chip">${visitas.length} visita${visitas.length === 1 ? "" : "s"}</span><span class="chip">${esc(U.telVisible(p.whatsapp))}</span></div>
      </div>
      <div class="actions">
        <a class="btn btn--sm btn--wa" href="${waPaciente(p)}" target="_blank" rel="noopener">${I("wa")}WhatsApp</a>
        <button class="btn btn--sm btn--ghost" data-nt>${I("calplus")}Nuevo turno</button>
        <button class="btn btn--sm btn--ghost" data-cobro>${I("cash")}Registrar cobro</button>
      </div>
      <p class="section-label">Notas</p>
      <div class="field"><label class="sr-only" for="pf-notas">Notas</label><textarea class="textarea" id="pf-notas" placeholder="Alergias, preferencias, observaciones…">${esc(p.notas)}</textarea><span class="field-hint" id="pf-notas-st">Se guardan solas al salir del campo.</span></div>
      <p class="section-label">Tratamientos realizados</p>
      <div class="chips">${tratamientos.length ? tratamientos.map((t) => `<span class="chip chip--wood">${esc(t)}</span>`).join("") : `<span class="muted" style="font-size:14px">Todavía ninguno.</span>`}</div>
      <p class="section-label">Historial de turnos</p>
      <div class="subcard"><div class="hist">${ts.length ? ts.map((t) => `<div class="hist-row" data-t="${t.id}"><b>${esc(t.tratamiento)} · ${esc(proCorto(t.profesionalId, t.profesional))}</b><small>${esc(cap(U.fmtDia(t.fecha)))} ${U.parseISO(t.fecha).getFullYear()} · ${t.hora} hs${t.origen === "web" ? " · web" : ""}</small>${estadoTag(t.estado)}</div>`).join("") : `<span class="muted">Sin turnos.</span>`}</div></div>
      <p class="section-label">Pagos</p>
      <div class="subcard">
        <div class="chips"><span class="chip">Pagado: <b class="money-pos">${U.money(sum(pg.filter((x) => x.estado !== "pendiente")))}</b></span><span class="chip">Pendiente: <b class="money-pend">${U.money(sum(pg.filter((x) => x.estado === "pendiente")))}</b></span></div>
        ${pg.length ? `<div class="hist">${pg.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((x) => `<div class="hist-row" data-pg="${x.id}"><b>${U.money(x.monto)} · ${esc(x.tratamiento || "")}</b><small>${fechaCorta(x.fecha)}${x.medio ? " · " + esc(x.medio) : ""}</small>${pagoTag(x.estado)}</div>`).join("")}</div>` : ""}
      </div>
      <p class="section-label">Datos</p>
      <form class="form subcard" id="pf-form" novalidate>
        <div class="row">
          <div class="field"><label for="pf-nombre">Nombre y apellido</label><input class="input" id="pf-nombre" value="${esc(p.nombre)}"></div>
          <div class="field"><label for="pf-wa">WhatsApp</label><input class="input" id="pf-wa" type="tel" value="${esc(p.whatsapp)}"></div>
        </div>
        <div class="row">
          <div class="field"><label for="pf-email">Email</label><input class="input" id="pf-email" type="email" value="${esc(p.email)}"></div>
          <div class="field"><label for="pf-os">Obra social</label><select class="select" id="pf-os">${C.obrasSociales.concat(C.obrasSociales.includes(p.obraSocial) ? [] : [p.obraSocial]).map((o) => `<option${o === p.obraSocial ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></div>
        </div>
        <div><button class="btn btn--sm" type="submit">Guardar datos</button></div>
      </form>`;
    m.setFoot("");
    const notas = $("#pf-notas", m);
    notas.addEventListener("blur", () => {
      if (notas.value === (S.paciente(id).notas || "")) return;
      S.guardarPaciente(id, { notas: notas.value });
      $("#pf-notas-st", m).textContent = "Notas guardadas ✓";
    });
    $("[data-nt]", m).addEventListener("click", () => { m.close(); abrirNuevoTurno({ pacienteId: id }); });
    $("[data-cobro]", m).addEventListener("click", () => abrirCobro({ pacienteId: id, onSave: () => pintarPaciente(m, id) }));
    $$("[data-t]", m).forEach((r) => r.addEventListener("click", () => { m.close(); abrirTurno(r.dataset.t); }));
    $$("[data-pg]", m).forEach((r) => r.addEventListener("click", () => abrirCobro({ pagoId: r.dataset.pg, onSave: () => pintarPaciente(m, id) })));
    $("#pf-form", m).addEventListener("submit", (e) => {
      e.preventDefault();
      const nombre = $("#pf-nombre", m).value.trim();
      if (nombre.length < 3) { toast("Revisá el nombre"); return; }
      S.guardarPaciente(id, { nombre, whatsapp: U.normalizarTel($("#pf-wa", m).value), email: $("#pf-email", m).value.trim(), obraSocial: $("#pf-os", m).value, notas: notas.value });
      toast("Datos del paciente guardados");
      pintarPaciente(m, id);
    });
  }

  /* ================================================================ PAGOS */
  function semanasDelMes(pgs) {
    const hoy = U.hoy();
    const y = hoy.getFullYear(), mo = hoy.getMonth();
    const ultimo = new Date(y, mo + 1, 0).getDate();
    const out = [];
    for (let w = 0; w * 7 < ultimo; w++) {
      const d1 = w * 7 + 1, d2 = Math.min(ultimo, w * 7 + 7);
      const a = U.toISO(new Date(y, mo, d1)), b = U.toISO(new Date(y, mo, d2));
      out.push({ label: `${d1}–${d2}`, total: sum(pgs.filter((p) => p.estado !== "pendiente" && p.fecha >= a && p.fecha <= b)), actual: hoy.getDate() >= d1 && hoy.getDate() <= d2, futuro: hoy.getDate() < d1 });
    }
    return out;
  }

  function vPagos() {
    const hoy = U.hoy();
    const mesNom = U.MESES[hoy.getMonth()];
    const pref = U.hoyISO().slice(0, 7);
    const pgs = S.pagos();
    const delMes = pgs.filter((p) => p.fecha.startsWith(pref));
    const cobrado = sum(delMes.filter((p) => p.estado !== "pendiente"));
    const senas = delMes.filter((p) => p.estado === "seña");
    const pend = pgs.filter((p) => p.estado === "pendiente");
    head("Pagos", "Pagos", "Los carga la secretaria a mano. Los pagos se arreglan por WhatsApp o en el consultorio.", `<button class="btn" data-cmd="cobro">${I("plus")}Registrar cobro</button>`);

    const sem = semanasDelMes(pgs);
    const max = Math.max(1, ...sem.map((s) => s.total));
    const filtros = [["todos", "Todos"], ["pagado", "Pagado"], ["seña", "Seña"], ["pendiente", "Pendiente"]];
    const lista = pgs.filter((p) => st.pagoFiltro === "todos" || p.estado === st.pagoFiltro).sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || "").localeCompare(a.creado || ""));

    $("#view").innerHTML = `<div class="stack">
      <div class="kpis kpis--3">
        <div class="kpi kpi--accent"><small>Cobrado en ${mesNom}</small><b>${moneyCorto(cobrado)}</b><span>${U.money(cobrado)} · incluye señas</span></div>
        <div class="kpi"><small>Señas recibidas</small><b>${moneyCorto(sum(senas))}</b><span>${senas.length} seña${senas.length === 1 ? "" : "s"} este mes</span></div>
        <div class="kpi kpi--warn"><small>Pendiente de cobro</small><b>${moneyCorto(sum(pend))}</b><span>${pend.length} cobro${pend.length === 1 ? "" : "s"} por hacer</span></div>
      </div>
      <section class="card">
        <div class="card-head"><h2>Cobrado por semana</h2><span class="muted">${cap(mesNom)} ${hoy.getFullYear()}</span></div>
        <div class="chart" role="img" aria-label="Gráfico de barras con lo cobrado por semana">
          ${sem.map((s) => `<div class="bar${s.actual ? " is-current" : ""}"><span class="bar-val">${s.futuro ? "" : moneyCorto(s.total)}</span><div class="bar-track"><div class="bar-fill" style="height:${Math.max(2, (s.total / max) * 100)}%"></div></div><span class="bar-lbl">${s.label} ${mesNom.slice(0, 3)}</span></div>`).join("")}
        </div>
      </section>
      <section class="card">
        <div class="toolbar"><h2>Cobros</h2><div class="pills" role="group" aria-label="Filtrar cobros">${filtros.map(([k, l]) => `<button class="pill${st.pagoFiltro === k ? " is-active" : ""}" data-pf="${k}">${l}</button>`).join("")}</div></div>
        ${lista.length ? `<table class="table">
          <thead><tr><th>Fecha</th><th>Paciente</th><th>Tratamiento</th><th>Medio</th><th>Estado</th><th class="num">Monto</th><th></th></tr></thead>
          <tbody>${lista.map((p) => `<tr data-pgid="${p.id}">
            <td class="hide-sm">${fechaCorta(p.fecha)}</td>
            <td><b>${esc(p.paciente)}</b><small class="only-sm muted">${fechaCorta(p.fecha)} · ${esc(p.tratamiento || "—")}${p.medio ? " · " + esc(p.medio) : ""}</small></td>
            <td class="hide-sm">${esc(p.tratamiento || "—")}</td>
            <td class="hide-sm">${esc(p.medio || "—")}</td>
            <td>${pagoTag(p.estado)}</td>
            <td class="num right"><b>${U.money(p.monto)}</b></td>
            <td class="num">${p.estado === "pendiente" ? `<button class="btn btn--xs" data-cobrar="${p.id}">${I("cash")}Cobrar</button>` : ""}</td>
          </tr>`).join("")}</tbody></table>` : `<div class="empty">${I("cash")}<b>No hay cobros con ese filtro</b></div>`}
      </section>
    </div>`;
    $$("[data-pf]").forEach((b) => b.addEventListener("click", () => { st.pagoFiltro = b.dataset.pf; vPagos(); }));
    $$("[data-pgid]").forEach((r) => r.addEventListener("click", (e) => {
      const c = e.target.closest("[data-cobrar]");
      abrirCobro({ pagoId: r.dataset.pgid, cobrar: !!c });
    }));
  }

  function abrirCobro(pre) {
    pre = pre || {};
    const edit = pre.pagoId ? S.pagos().find((x) => x.id === pre.pagoId) : null;
    const hoy = U.hoyISO();
    const ts = S.turnos().filter((t) => t.estado !== "cancelado" && Math.abs(U.diffDias(t.fecha)) <= 45).sort(byFH).reverse();
    const turnoSel = pre.turnoId || (edit && edit.turnoId) || "";
    if (turnoSel && !ts.some((t) => t.id === turnoSel)) { const t = S.turno(turnoSel); if (t) ts.unshift(t); }
    const pacs = S.pacientes().slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
    const estado0 = pre.cobrar ? "pagado" : edit ? edit.estado : "pagado";
    const m = modal({
      title: edit ? (pre.cobrar ? "Cobrar pendiente" : "Editar cobro") : "Registrar cobro",
      sub: "Pagos en efectivo, transferencia, tarjeta o Mercado Pago.",
      body: `<form class="form" novalidate>
        <div class="field"><label for="pg-turno">Turno</label><select class="select" id="pg-turno"><option value="">Sin turno (elegir paciente)</option>${ts.map((t) => `<option value="${t.id}"${turnoSel === t.id ? " selected" : ""}>${fechaCorta(t.fecha)} · ${esc(t.paciente)} · ${esc(t.tratamiento)}</option>`).join("")}</select></div>
        <div class="field" id="pg-pac-f"><label for="pg-pac">Paciente</label><select class="select" id="pg-pac"><option value="">Elegí un paciente</option>${pacs.map((p) => `<option value="${p.id}"${(pre.pacienteId || (edit && edit.pacienteId)) === p.id ? " selected" : ""}>${esc(p.nombre)}</option>`).join("")}</select></div>
        <div class="field"><label for="pg-con">Concepto</label><input class="input" id="pg-con" value="${esc(edit ? edit.tratamiento : "")}" placeholder="Ej: Limpieza dental"></div>
        <div class="row">
          <div class="field"><label for="pg-monto">Monto ($)</label><input class="input" id="pg-monto" type="number" inputmode="numeric" min="0" step="500" value="${edit ? edit.monto : ""}"><span class="field-hint" id="pg-hint"></span></div>
          <div class="field"><label for="pg-medio">Medio</label><select class="select" id="pg-medio">${C.panel.mediosDePago.map((x) => `<option${edit && edit.medio === x ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
        </div>
        <div class="field"><span class="field-label">Tipo</span>
          <div class="seg" role="radiogroup" aria-label="Tipo de cobro">
            <label><input type="radio" name="pg-estado" value="pagado"${estado0 === "pagado" ? " checked" : ""}><span>Pago total</span></label>
            <label><input type="radio" name="pg-estado" value="seña"${estado0 === "seña" ? " checked" : ""}><span>Seña</span></label>
            <label><input type="radio" name="pg-estado" value="pendiente"${estado0 === "pendiente" ? " checked" : ""}><span>Pendiente</span></label>
          </div>
        </div>
        <div class="field"><label for="pg-fecha">Fecha</label><input class="input" id="pg-fecha" type="date" value="${pre.cobrar ? hoy : edit ? edit.fecha : hoy}"></div>
        <div class="field-error" id="pg-err" style="display:block"></div>
      </form>`,
      foot: `${edit ? `<button class="btn btn--ghost" data-del style="margin-right:auto">${I("trash")}Eliminar</button>` : ""}<button class="btn btn--ghost" data-close>Cancelar</button><button class="btn" data-save>${I("check")}Guardar</button>`
    });
    const f = (id) => $("#" + id, m);
    const pintarSel = (inicial) => {
      const t = S.turno(f("pg-turno").value);
      f("pg-pac-f").hidden = !!t;
      if (!t) { f("pg-hint").textContent = ""; return; }
      const tr = S.tratamiento(t.tratamientoId);
      const pagado = pagadoDeTurno(t.id) - (edit && edit.estado !== "pendiente" ? Number(edit.monto) : 0);
      const resta = Math.max(0, (tr ? tr.precio : 0) - pagado);
      f("pg-hint").textContent = tr ? `Precio de referencia ${U.money(tr.precio)}${pagado ? ` · ya pagó ${U.money(pagado)}` : ""}` : "";
      if (!inicial || !edit) { f("pg-con").value = t.tratamiento; if (!edit) f("pg-monto").value = resta || ""; }
    };
    f("pg-turno").addEventListener("change", () => pintarSel(false));
    pintarSel(true);
    $("[data-close]", m).addEventListener("click", m.close);
    if (edit) $("[data-del]", m).addEventListener("click", () => {
      confirmar({ title: "¿Eliminar este cobro?", text: `${esc(edit.paciente)} · ${U.money(edit.monto)}`, ok: "Eliminar", danger: true }).then((ok) => {
        if (!ok) return;
        S.eliminarPago(edit.id); m.close(); toast("Cobro eliminado"); if (pre.onSave) pre.onSave();
      });
    });
    $("[data-save]", m).addEventListener("click", () => {
      const t = S.turno(f("pg-turno").value);
      const pac = t ? S.paciente(t.pacienteId) || { id: t.pacienteId, nombre: t.paciente } : S.paciente(f("pg-pac").value);
      const monto = Number(f("pg-monto").value);
      const estado = $('input[name="pg-estado"]:checked', m).value;
      if (!pac) { f("pg-err").textContent = "Elegí el turno o el paciente."; return; }
      if (!monto || monto <= 0) { f("pg-err").textContent = "Poné el monto."; return; }
      const data = {
        fecha: f("pg-fecha").value || hoy, pacienteId: pac.id, paciente: pac.nombre, turnoId: t ? t.id : "",
        tratamiento: f("pg-con").value.trim() || (t ? t.tratamiento : "Cobro"), monto, medio: estado === "pendiente" ? "" : f("pg-medio").value, estado
      };
      if (edit) S.actualizarPago(edit.id, data); else S.crearPago(data);
      m.close();
      toast(estado === "pendiente" ? "Cobro pendiente anotado" : `Cobro de ${U.money(monto)} registrado`);
      if (pre.onSave) pre.onSave();
    });
  }

  /* ============================================================== AJUSTES */
  function vAjustes() {
    const aj = S.ajustes();
    head("Ajustes", "Ajustes", "Se guardan en este navegador. “Reiniciar demo” vuelve todo a como estaba.", "");
    const orden = [1, 2, 3, 4, 5, 6, 0];
    const nombres = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const ejemplo = S.turnos().filter((t) => t.fecha >= U.hoyISO() && t.estado !== "cancelado").sort(byFH)[0] || {
      paciente: "Sofía Gómez", tratamiento: "Limpieza dental", fecha: U.toISO(U.addDays(U.hoy(), 1)), hora: "10:30", profesionalId: C.profesionales[0].id, codigo: "LUM-4821"
    };
    const durOpts = (sel) => [15, 30, 45, 60, 75, 90, 120, 150, 180].map((n) => `<option value="${n}"${Number(sel) === n ? " selected" : ""}>${n} min</option>`).join("");
    const MSG = [["confirmacion", "Confirmación", "Se manda al tocar “Confirmar y avisar”."], ["recordatorio", "Recordatorio", "Para mandar el día anterior al turno."], ["reprogramar", "Rechazar / reprogramar", "Cuando no se puede mantener el horario pedido."]];

    $("#view").innerHTML = `<div class="settings">
      <section class="card">
        <div class="card-head"><h2>Horarios de atención</h2></div>
        <div class="hours">${orden.map((d) => {
          const r = aj.horarios[d] || [];
          const a = r.length ? r[0][0] : "09:00", b = r.length ? r[r.length - 1][1] : "13:00";
          return `<div class="hour-row${r.length ? "" : " is-closed"}" data-dow="${d}">
            <label class="switch"><input type="checkbox"${r.length ? " checked" : ""} aria-label="Abierto ${nombres[d]}"><i></i>${nombres[d].slice(0, 3)}</label>
            <div class="times"><input class="input" type="time" value="${a}" step="1800" aria-label="Abre ${nombres[d]}"><span class="muted">a</span><input class="input" type="time" value="${b}" step="1800" aria-label="Cierra ${nombres[d]}"></div>
          </div>`;
        }).join("")}</div>
        <p class="field-hint" style="margin:12px 0 14px">Los feriados se cargan en config.js. La web solo ofrece turnos dentro de estos horarios.</p>
        <button class="btn btn--sm" id="saveHorarios">Guardar horarios</button>
      </section>

      <section class="card">
        <div class="card-head"><h2>Duración de turnos</h2></div>
        <div class="form">
          <div class="field"><label for="aj-int">Cada cuánto se ofrece un horario</label><select class="select" id="aj-int">${[15, 20, 30, 45, 60].map((n) => `<option value="${n}"${aj.intervalo === n ? " selected" : ""}>Cada ${n} minutos</option>`).join("")}</select></div>
          <p class="section-label" style="margin:4px 0 0">Duración por tratamiento</p>
          <div class="dur-list">${S.tratamientos().map((t) => `<div class="dur-row"><label for="dur-${t.id}">${esc(t.nombre)}</label><select class="select" id="dur-${t.id}" data-dur="${t.id}">${durOpts(t.duracion)}</select></div>`).join("")}</div>
          <div><button class="btn btn--sm" id="saveDur">Guardar duraciones</button></div>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>WhatsApp de la secretaria</h2></div>
        <div class="form">
          <div class="field"><label for="aj-wa">Número (con código de país y área)</label><input class="input" id="aj-wa" type="tel" value="${esc(aj.whatsapp)}"><span class="field-hint">Ej: 5492914123456. A este número llegan los turnos que se sacan desde la web.</span></div>
          <div><button class="btn btn--sm" id="saveWa">Guardar número</button></div>
        </div>
      </section>

      <section class="card wide">
        <div class="card-head"><h2>Textos de los mensajes</h2><button class="link-btn" id="resetMsg">Volver a los textos originales</button></div>
        <p class="vars" style="margin-bottom:16px">Podés usar: ${["nombre", "tratamiento", "dia", "hora", "cuando", "profesional", "direccion", "codigo", "consultorio"].map((v) => `<code>{${v}}</code>`).join(" ")}</p>
        <div class="settings">${MSG.map(([k, l, h]) => `
          <div class="form">
            <div class="field"><label for="msg-${k}">${l}</label><textarea class="textarea" id="msg-${k}" data-msg="${k}" rows="4">${esc(aj.mensajes[k])}</textarea><span class="field-hint">${h}</span></div>
            <div><p class="section-label" style="margin-bottom:6px">Vista previa</p><div class="preview" data-prev="${k}"></div></div>
          </div>`).join("")}
        </div>
        <div style="margin-top:16px"><button class="btn btn--sm" id="saveMsg">Guardar mensajes</button></div>
      </section>

      <section class="card wide danger-zone">
        <div class="card-head"><h2>Demo</h2></div>
        <p class="muted" style="margin-bottom:14px">Borra todos los turnos, pacientes, pagos y ajustes, y vuelve a cargar los datos de ejemplo.</p>
        <button class="btn btn--danger" id="resetDemo">${I("reload")}Reiniciar demo</button>
      </section>
    </div>`;

    $$(".hour-row input[type=checkbox]").forEach((c) => c.addEventListener("change", () => c.closest(".hour-row").classList.toggle("is-closed", !c.checked)));
    $("#saveHorarios").addEventListener("click", () => {
      const h = {};
      let error = false;
      $$(".hour-row").forEach((r) => {
        const d = r.dataset.dow;
        const [chk, a, b] = $$("input", r);
        if (chk.checked && (!a.value || !b.value || b.value <= a.value)) error = true;
        h[d] = chk.checked ? [[a.value, b.value]] : [];
      });
      if (error) { toast("Revisá los horarios: el cierre tiene que ser después de la apertura"); return; }
      S.guardarAjustes({ horarios: h });
      toast("Horarios guardados");
    });
    $("#saveDur").addEventListener("click", () => {
      const dur = {};
      $$("[data-dur]").forEach((s) => { const base = C.tratamientos.find((t) => t.id === s.dataset.dur); if (base && Number(s.value) !== base.duracion) dur[s.dataset.dur] = Number(s.value); });
      S.guardarAjustes({ intervalo: Number($("#aj-int").value), duraciones: dur });
      toast("Duraciones guardadas");
    });
    $("#saveWa").addEventListener("click", () => {
      const n = $("#aj-wa").value.replace(/\D/g, "");
      if (n.length < 11) { toast("El número parece incompleto"); return; }
      S.guardarAjustes({ whatsapp: n });
      toast("Número guardado");
    });
    const previa = () => $$("[data-msg]").forEach((t) => { $(`[data-prev="${t.dataset.msg}"]`).textContent = U.fill(t.value, S.datosMensaje(ejemplo)); });
    $$("[data-msg]").forEach((t) => t.addEventListener("input", previa));
    previa();
    $("#saveMsg").addEventListener("click", () => {
      const msgs = {};
      $$("[data-msg]").forEach((t) => { msgs[t.dataset.msg] = t.value.trim() || C.mensajes[t.dataset.msg]; });
      S.guardarAjustes({ mensajes: msgs });
      toast("Mensajes guardados");
    });
    $("#resetMsg").addEventListener("click", () => {
      $$("[data-msg]").forEach((t) => { t.value = C.mensajes[t.dataset.msg]; });
      previa();
      toast("Textos originales cargados. Tocá “Guardar mensajes” para aplicarlos.");
    });
    $("#resetDemo").addEventListener("click", () => {
      confirmar({ title: "¿Reiniciar el demo?", text: "Se borran los turnos sacados, los cambios y los ajustes, y se cargan de nuevo los datos de ejemplo.", ok: "Sí, reiniciar", danger: true }).then((ok) => {
        if (!ok) return;
        try { localStorage.removeItem("lumen.misDatos"); localStorage.removeItem(TIP); } catch (e) {}
        S.reiniciar();
        st.pagoFiltro = "todos"; st.q = ""; st.pro = "todos"; st.semana = lunes(U.hoy());
        toast("Demo reiniciado con datos de ejemplo");
        ir("hoy");
      });
    });
  }

  /* ======================================================= actualización */
  const idsNuevos = () => S.turnos().filter((t) => t.estado === "nuevo").map((t) => t.id);
  let vistos = new Set(idsNuevos());
  let pend = false;
  S.on(() => {
    const ids = idsNuevos();
    const llegados = ids.filter((id) => !vistos.has(id));
    vistos = new Set(ids);
    if (!sesion()) return;
    llegados.forEach((id) => {
      const t = S.turno(id);
      if (t && t.origen === "web") toast(`Nuevo turno desde la web: ${t.paciente}`, { label: "Ver", fn: () => abrirTurno(t.id) });
    });
    if (pend) return;
    pend = true;
    requestAnimationFrame(() => {
      pend = false;
      if (st.vista === "ajustes") { renderNav(); return; } // no pisar lo que se está editando
      const q = document.activeElement && document.activeElement.id === "q";
      render();
      if (q) { const el = $("#q"); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  });
  // Refrescar "hace X min", la línea de la hora actual y el próximo turno.
  setInterval(() => { if (sesion() && !$("#modals").children.length && (st.vista === "hoy" || st.vista === "agenda")) render(); }, 60000);

  /* ================================================================ login */
  function sesion() { try { return sessionStorage.getItem(SES) === "1"; } catch (e) { return !!window.__lumenSes; } }
  function setSesion(v) { try { v ? sessionStorage.setItem(SES, "1") : sessionStorage.removeItem(SES); } catch (e) { window.__lumenSes = v; } }

  function entrar() {
    $("#login").hidden = true;
    $("#app").hidden = false;
    $("#verWeb").innerHTML = I("web") + "Ver la web";
    $("#logout").innerHTML = I("salir") + "Salir";
    render();
  }

  function initLogin() {
    const pin = $("#pin"), dots = $$(".pin-dots i"), wrap = $(".pin-wrap"), err = $("#pinError");
    const paint = () => { const n = pin.value.length; dots.forEach((d, i) => { d.classList.toggle("is-on", i < n); d.classList.toggle("is-next", i === Math.min(n, 3)); }); };
    const check = () => {
      if (pin.value === String(C.panel.pin)) { setSesion(true); pin.value = ""; paint(); entrar(); return; }
      err.textContent = pin.value.length < 4 ? "El PIN tiene 4 números." : "PIN incorrecto. Probá de nuevo.";
      wrap.classList.remove("is-error"); void wrap.offsetWidth; wrap.classList.add("is-error");
      pin.value = ""; paint(); pin.focus();
    };
    pin.addEventListener("input", () => {
      pin.value = pin.value.replace(/\D/g, "").slice(0, 4);
      err.textContent = ""; wrap.classList.remove("is-error"); paint();
      if (pin.value.length === 4) setTimeout(check, 120);
    });
    $("#loginForm").addEventListener("submit", (e) => { e.preventDefault(); check(); });
    paint();
  }

  $("#logout").addEventListener("click", () => {
    setSesion(false);
    // Sacamos el ?demo de la dirección para que al recargar pida el PIN.
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
    $("#app").hidden = true; $("#login").hidden = false; $("#pin").focus();
  });

  /* ------------------------------------------------------------ barra demo */
  (function () {
    const bar = $("#demoBar");
    const cerrar = () => { bar.remove(); document.body.classList.remove("has-demo-bar"); };
    try { if (sessionStorage.getItem("lumen.demoBar") === "0") cerrar(); } catch (e) {}
    const x = $("#demoBarClose");
    if (x) x.addEventListener("click", () => { try { sessionStorage.setItem("lumen.demoBar", "0"); } catch (e) {} cerrar(); });
  })();

  initLogin();
  if (MODO_DEMO) {
    setSesion(true);
    // La primera vez que se entra en modo demo se muestra el cartelito (hasta que se cierre).
    try { if (!localStorage.getItem(TIP)) { localStorage.setItem(TIP, "visto"); sessionStorage.setItem(TIP, "1"); } } catch (e) {}
  }
  if (sesion()) entrar();
  else { $("#login").hidden = false; setTimeout(() => $("#pin").focus(), 100); }
})();
