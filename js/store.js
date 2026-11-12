/* =========================================================================
   LUMEN · CAPA DE DATOS
   -------------------------------------------------------------------------
   La web y el panel leen y escriben SOLO a través de este archivo.
   En el demo todo vive en localStorage (mismo navegador = mismos datos).

   Para pasar a Supabase: reemplazar las funciones de la sección "DB"
   (read/write) y los CRUD por llamadas a la API, manteniendo los mismos
   nombres. Tablas sugeridas: pacientes, turnos, pagos, bloqueos, ajustes
   (ver README.md).
   ========================================================================= */
(function () {
  "use strict";
  const C = window.LUMEN_CONFIG;

  /* ---------------------------------------------------------------- utils */
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const hoyISO = () => toISO(new Date());
  const toMin = (h) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
  const toHHMM = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const DIAS_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const diffDias = (iso) => Math.round((parseISO(iso) - hoy()) / 86400000);
  const fmtDia = (iso) => { const d = parseISO(iso); return `${DIAS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
  const fmtDiaLargo = (iso) => { const d = parseISO(iso); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
  const cuando = (iso) => { const n = diffDias(iso); return n === 0 ? "hoy" : n === 1 ? "mañana" : "el " + fmtDia(iso); };
  const money = (n) => "$" + Math.round(n || 0).toLocaleString("es-AR");
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const primerNombre = (n) => (n || "").trim().split(/\s+/)[0] || "";
  const iniciales = (n) => (n || "").trim().split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase();
  const fill = (tpl, data) => String(tpl || "").replace(/\{(\w+)\}/g, (m, k) => (data[k] != null ? data[k] : m));

  // Teléfono argentino → formato wa.me (549 + área + número).
  function normalizarTel(raw) {
    let d = String(raw || "").replace(/\D/g, "");
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith("549")) return d;
    if (d.startsWith("54")) return "549" + d.slice(2);
    if (d.startsWith("0")) d = d.slice(1);
    return "549" + d;
  }
  function telVisible(num) {
    const d = String(num || "").replace(/\D/g, "");
    if (d.length === 13 && d.startsWith("549")) return `+54 9 ${d.slice(3, 6)} ${d.slice(6, 9)}-${d.slice(9)}`;
    return d ? "+" + d : "";
  }
  const waLink = (num, text) => `https://wa.me/${String(num).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
  function abrirWhatsApp(num, text, titulo) {
    // Modo demo: no se abre WhatsApp, se muestra cómo quedaría el mensaje.
    if (C.modoDemo) { vistaPreviaWhatsApp(text, titulo); return; }
    const url = waLink(num, text);
    const w = window.open(url, "_blank", "noopener");
    if (!w) location.href = url;
  }

  /* ------------------------------------------- vista previa (modo demo) */
  const horaAhora = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const burbujaWA = (text) =>
    `<div class="wa-chat"><div class="wa-bubble"><p>${esc(text).replace(/\n/g, "<br>")}</p><span class="wa-meta">${horaAhora()} <svg viewBox="0 0 18 12" aria-hidden="true"><path d="M1 6.5l3 3 6-7M7 9.5l1 1 6-8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div></div>`;
  function vistaPreviaWhatsApp(text, titulo) {
    const viejo = document.querySelector(".wa-demo-root");
    if (viejo) viejo.remove();
    const root = document.createElement("div");
    root.className = "wa-demo-root";
    root.innerHTML = `<div class="wa-demo-backdrop"></div>
      <div class="wa-demo" role="dialog" aria-modal="true" aria-label="Vista previa del mensaje de WhatsApp">
        <div class="wa-demo-head"><b>${esc(titulo || "Así se vería el mensaje")}</b><button class="wa-demo-x" aria-label="Cerrar">✕</button></div>
        ${burbujaWA(text)}
        <p class="wa-demo-note">Esto es un demo: no se envía nada. En el consultorio real, se abre WhatsApp con este mensaje listo para mandar.</p>
        <button class="btn btn--block wa-demo-ok">Entendido</button>
      </div>`;
    document.body.appendChild(root);
    const cerrar = () => root.remove();
    root.querySelector(".wa-demo-backdrop").addEventListener("click", cerrar);
    root.querySelector(".wa-demo-x").addEventListener("click", cerrar);
    root.querySelector(".wa-demo-ok").addEventListener("click", cerrar);
    setTimeout(() => root.querySelector(".wa-demo-ok").focus(), 30);
  }
  // En modo demo, cualquier link a WhatsApp de la página muestra la vista previa en vez de abrirse.
  if (C.modoDemo) {
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest('a[href^="https://wa.me/"]');
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      let text = "";
      try { text = new URL(a.href).searchParams.get("text") || ""; } catch (err) {}
      vistaPreviaWhatsApp(text || "Hola! Quería hacer una consulta.");
    }, true);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const r = document.querySelector(".wa-demo-root"); if (r) r.remove(); } });
  }

  /* ------------------------------------------------------------------- DB */
  const KEYS = {
    turnos: "lumen.turnos",
    pacientes: "lumen.pacientes",
    pagos: "lumen.pagos",
    bloqueos: "lumen.bloqueos",
    ajustes: "lumen.ajustes",
    seed: "lumen.seed"
  };
  const SEED_VERSION = "2";
  const mem = {}; // respaldo si el navegador bloquea localStorage

  function read(k, def) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : def;
    } catch (e) {
      return k in mem ? JSON.parse(mem[k]) : def;
    }
  }
  function write(k, v) {
    const s = JSON.stringify(v);
    mem[k] = s;
    try { localStorage.setItem(k, s); } catch (e) { /* modo privado: queda en memoria */ }
    emit();
  }

  const listeners = [];
  function emit() { listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
  function on(fn) { listeners.push(fn); }
  // Cambios hechos en otra pestaña (ej: turno sacado en la web con el panel abierto).
  window.addEventListener("storage", (e) => { if (!e.key || e.key.startsWith("lumen.")) emit(); });

  /* -------------------------------------------------------------- ajustes */
  function ajustes() {
    const a = read(KEYS.ajustes, {});
    return {
      horarios: a.horarios || C.horarios,
      intervalo: Number(a.intervalo) || C.turnos.intervalo,
      whatsapp: a.whatsapp || C.consultorio.whatsapp,
      duraciones: a.duraciones || {},
      mensajes: Object.assign({}, C.mensajes, a.mensajes || {})
    };
  }
  function guardarAjustes(patch) { write(KEYS.ajustes, Object.assign(read(KEYS.ajustes, {}), patch)); }

  /* ------------------------------------------------ catálogo (config.js) */
  function tratamientos() {
    const dur = ajustes().duraciones;
    return C.tratamientos.map((t) => Object.assign({}, t, dur[t.id] ? { duracion: Number(dur[t.id]) } : {}));
  }
  const tratamiento = (id) => tratamientos().find((t) => t.id === id) || null;
  const profesionales = () => C.profesionales;
  const profesional = (id) => C.profesionales.find((p) => p.id === id) || null;
  function profesionalesPara(tratId) {
    const t = tratamiento(tratId);
    if (!t || !t.profesionales || !t.profesionales.length) return C.profesionales;
    return C.profesionales.filter((p) => t.profesionales.includes(p.id));
  }

  /* --------------------------------------------------------------- turnos */
  const turnos = () => read(KEYS.turnos, []);
  const turno = (id) => turnos().find((t) => t.id === id) || null;

  function nuevoCodigo(lista) {
    const usados = new Set(lista.map((t) => t.codigo));
    let c;
    do { c = "LUM-" + (1000 + Math.floor(Math.random() * 9000)); } while (usados.has(c));
    return c;
  }

  function crearTurno(data) {
    const lista = turnos();
    const pac = buscarOCrearPaciente(data);
    const t = Object.assign({
      id: uid(),
      codigo: nuevoCodigo(lista),
      creado: new Date().toISOString(),
      origen: "web",
      estado: "nuevo",
      email: "",
      comentario: "",
      primeraVez: false
    }, data, { pacienteId: pac.id, whatsapp: normalizarTel(data.whatsapp) });
    lista.push(t);
    write(KEYS.turnos, lista);
    return t;
  }

  function actualizarTurno(id, patch) {
    const lista = turnos();
    const i = lista.findIndex((t) => t.id === id);
    if (i < 0) return null;
    lista[i] = Object.assign({}, lista[i], patch, { actualizado: new Date().toISOString() });
    write(KEYS.turnos, lista);
    return lista[i];
  }

  /* ------------------------------------------------------------ pacientes */
  const pacientes = () => read(KEYS.pacientes, []);
  const paciente = (id) => pacientes().find((p) => p.id === id) || null;

  function buscarOCrearPaciente({ paciente: nombre, whatsapp, email, obraSocial }) {
    const lista = pacientes();
    const tel = normalizarTel(whatsapp);
    let p = lista.find((x) => x.whatsapp === tel);
    if (p) {
      // Actualizamos datos que el paciente haya corregido.
      Object.assign(p, { nombre: nombre || p.nombre, email: email || p.email, obraSocial: obraSocial || p.obraSocial });
    } else {
      p = { id: uid(), nombre, whatsapp: tel, email: email || "", obraSocial: obraSocial || "Particular", notas: "", creado: new Date().toISOString() };
      lista.push(p);
    }
    write(KEYS.pacientes, lista);
    return p;
  }

  function guardarPaciente(id, patch) {
    const lista = pacientes();
    const i = lista.findIndex((p) => p.id === id);
    if (i < 0) return null;
    lista[i] = Object.assign({}, lista[i], patch);
    write(KEYS.pacientes, lista);
    // Mantener los datos copiados en los turnos.
    if (patch.nombre || patch.whatsapp || patch.obraSocial || patch.email != null) {
      const ts = turnos().map((t) => t.pacienteId === id ? Object.assign(t, {
        paciente: lista[i].nombre, whatsapp: lista[i].whatsapp, obraSocial: lista[i].obraSocial, email: lista[i].email
      }) : t);
      write(KEYS.turnos, ts);
    }
    return lista[i];
  }

  /* ---------------------------------------------------------------- pagos */
  const pagos = () => read(KEYS.pagos, []);
  function crearPago(p) {
    const lista = pagos();
    const pago = Object.assign({ id: uid(), fecha: hoyISO(), creado: new Date().toISOString(), estado: "pagado", medio: "Efectivo" }, p);
    lista.push(pago);
    write(KEYS.pagos, lista);
    return pago;
  }
  function actualizarPago(id, patch) {
    const lista = pagos();
    const i = lista.findIndex((p) => p.id === id);
    if (i < 0) return null;
    lista[i] = Object.assign({}, lista[i], patch);
    write(KEYS.pagos, lista);
    return lista[i];
  }
  function eliminarPago(id) { write(KEYS.pagos, pagos().filter((p) => p.id !== id)); }

  /* ------------------------------------------------------------- bloqueos */
  const bloqueos = () => read(KEYS.bloqueos, []);
  function crearBloqueo(b) {
    const lista = bloqueos();
    const nuevo = Object.assign({ id: uid(), profesionalId: "todos", motivo: "" }, b);
    lista.push(nuevo);
    write(KEYS.bloqueos, lista);
    return nuevo;
  }
  function eliminarBloqueo(id) { write(KEYS.bloqueos, bloqueos().filter((b) => b.id !== id)); }

  /* ----------------------------------------------------------- disponibilidad */
  const feriado = (iso) => (C.feriados || []).find((f) => f.fecha === iso) || null;

  function rangosDelDia(iso, horarios) {
    if (feriado(iso)) return [];
    return (horarios || ajustes().horarios)[parseISO(iso).getDay()] || [];
  }

  const ocupa = (t) => t.estado !== "cancelado";
  const choca = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

  function estaOcupado(ctx, proId, iso, ini, fin, excluirId) {
    for (const t of ctx.turnos) {
      if (t.id === excluirId || t.fecha !== iso || t.profesionalId !== proId || !ocupa(t)) continue;
      const s = toMin(t.hora);
      if (choca(ini, fin, s, s + Number(t.duracion))) return true;
    }
    for (const b of ctx.bloqueos) {
      if (b.fecha !== iso || (b.profesionalId !== "todos" && b.profesionalId !== proId)) continue;
      if (choca(ini, fin, toMin(b.desde), toMin(b.hasta))) return true;
    }
    return false;
  }

  /**
   * Horarios libres de un día.
   * proId: id del profesional o "any" (cualquiera disponible).
   * Devuelve [{ hora: "10:30", profesionales: ["ferraro", ...] }]
   */
  function horariosLibres(iso, tratId, proId, opts) {
    opts = opts || {};
    const t = tratamiento(tratId);
    if (!t) return [];
    const aj = ajustes();
    const dur = Number(opts.duracion || t.duracion);
    const step = aj.intervalo;
    const pros = proId && proId !== "any" ? [proId] : profesionalesPara(tratId).map((p) => p.id);
    const ctx = opts.ctx || { turnos: turnos(), bloqueos: bloqueos() };
    const ahora = new Date();
    const hoyS = toISO(ahora);
    if (!opts.permitirPasado && iso < hoyS) return [];
    const minimo = iso === hoyS && !opts.permitirPasado
      ? ahora.getHours() * 60 + ahora.getMinutes() + (opts.margen != null ? opts.margen : C.turnos.margenMinutos)
      : -1;
    const out = [];
    for (const [a, b] of rangosDelDia(iso, aj.horarios)) {
      for (let m = toMin(a); m + dur <= toMin(b); m += step) {
        if (m < minimo) continue;
        const libres = pros.filter((p) => !estaOcupado(ctx, p, iso, m, m + dur, opts.excluir));
        if (libres.length) out.push({ hora: toHHMM(m), profesionales: libres });
      }
    }
    return out;
  }

  /** Próximos N días con su disponibilidad (para el calendario de la web). */
  function dias(tratId, proId, n) {
    const ctx = { turnos: turnos(), bloqueos: bloqueos() };
    const out = [];
    for (let i = 0; i < (n || C.turnos.diasAnticipacion); i++) {
      const iso = toISO(addDays(hoy(), i));
      const fer = feriado(iso);
      const abierto = rangosDelDia(iso).length > 0;
      const libres = abierto ? horariosLibres(iso, tratId, proId, { ctx }) : [];
      out.push({ fecha: iso, feriado: fer, abierto, libres });
    }
    return out;
  }

  /* ------------------------------------------------------------- mensajes */
  function datosMensaje(t) {
    const p = profesional(t.profesionalId);
    return {
      nombre: primerNombre(t.paciente),
      tratamiento: t.tratamiento,
      dia: fmtDia(t.fecha),
      hora: t.hora,
      cuando: cuando(t.fecha),
      profesional: p ? p.articulo : "nuestro equipo",
      direccion: C.consultorio.direccion,
      codigo: t.codigo,
      consultorio: C.consultorio.nombre
    };
  }
  const mensaje = (tipo, t) => fill(ajustes().mensajes[tipo], datosMensaje(t));

  /* -------------------------------------------------- datos de ejemplo */
  const NOMBRES = [
    ["Sofía Gómez", "OSDE"], ["Martina López", "Swiss Medical"], ["Juan Pérez", "Particular"],
    ["Valentina Díaz", "Galeno"], ["Tomás Fernández", "OSDE"], ["Camila Rodríguez", "Medifé"],
    ["Lucas Martínez", "Sancor Salud"], ["Florencia Romero", "Particular"], ["Agustín Suárez", "OSDE"],
    ["Julieta Acosta", "Swiss Medical"], ["Mateo Benítez", "Galeno"], ["Micaela Herrera", "Particular"],
    ["Nicolás Medina", "Sancor Salud"], ["Paula Castro", "OSDE"], ["Facundo Ríos", "Medifé"],
    ["Antonella Molina", "Particular"], ["Gonzalo Ortiz", "Swiss Medical"], ["Carla Silva", "OSDE"],
    ["Emiliano Torres", "Galeno"], ["Rocío Navarro", "Particular"], ["Bruno Giménez", "Sancor Salud"],
    ["Lara Vega", "Medifé"], ["Santiago Ramos", "OSDE"], ["Mía Cabrera", "Particular"], ["Ignacio Luna", "Swiss Medical"]
  ];
  const NOTAS = [
    "", "", "", "Alérgica a la penicilina.", "Prefiere turnos a la mañana.", "", "Sensibilidad al frío en molares.",
    "", "Viene recomendado por Sofía Gómez.", "", "Usa placa de descanso.", "", "Hipertenso, controlado.", "", ""
  ];
  const COMENTARIOS = ["", "", "", "", "Me sangran un poco las encías.", "Tengo sensibilidad con el frío.", "Prefiero a primera hora.", "Vengo recomendada por una amiga.", "Me duele una muela de abajo."];
  // Peso de cada tratamiento en los turnos de ejemplo (más consultas y limpiezas).
  const PESOS = { consulta: 6, limpieza: 6, arreglos: 4, ortodoncia: 4, endodoncia: 2, cirugia: 1, implante: 2, rehabilitacion: 1, protesis: 1, blanqueamiento: 2, estetica: 1, odontopediatria: 0 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generarEjemplo() {
    const R = mulberry32(Number(hoyISO().replace(/-/g, "")));
    const pick = (arr) => arr[Math.floor(R() * arr.length)];
    const base = hoy();
    const ahora = new Date();
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const lista = C.tratamientos;
    const bolsa = [];
    lista.forEach((t) => { for (let i = 0; i < (PESOS[t.id] != null ? PESOS[t.id] : 1); i++) bolsa.push(t); });

    const pacs = NOMBRES.map(([nombre, os], i) => ({
      id: "p" + (i + 1),
      nombre,
      whatsapp: "5492915" + String(100000 + Math.floor(R() * 899999)),
      email: i % 3 === 0 ? nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(" ", ".") + "@mail.com" : "",
      obraSocial: os,
      notas: NOTAS[i] || "",
      creado: addDays(base, -90 + i).toISOString()
    }));
    const nina = pacs.find((p) => p.nombre === "Mía Cabrera");
    nina.notas = "Paciente de 7 años. Viene con su mamá (Laura).";

    // Bloqueos de ejemplo: almuerzo de equipo y un congreso.
    const diaHabil = (desde, cond) => {
      for (let i = desde; i < desde + 14; i++) {
        const iso = toISO(addDays(base, i));
        const dow = parseISO(iso).getDay();
        if (dow >= 1 && dow <= 5 && !feriado(iso) && (!cond || cond(dow))) return iso;
      }
      return null;
    };
    const bloqs = [];
    const dAlm = diaHabil(1);
    if (dAlm) bloqs.push({ id: "b1", fecha: dAlm, desde: "13:00", hasta: "14:00", profesionalId: "todos", motivo: "Almuerzo de equipo" });
    const dCong = diaHabil(8, (d) => d === 5);
    if (dCong) bloqs.push({ id: "b2", fecha: dCong, desde: "09:00", hasta: "20:00", profesionalId: "sosa", motivo: "Congreso de ortodoncia" });

    const ts = [];
    const ctx = { turnos: ts, bloqueos: bloqs };
    const codigos = new Set();
    const codigo = () => { let c; do { c = "LUM-" + (1000 + Math.floor(R() * 9000)); } while (codigos.has(c)); codigos.add(c); return c; };
    let idx = 0;
    const adultos = pacs.filter((p) => p !== nina); // la nena va aparte, con odontopediatría
    const siguientePac = () => adultos[(idx++) % adultos.length];

    function agendar(offset, opts) {
      opts = opts || {};
      const iso = toISO(addDays(base, offset));
      const rangos = rangosDelDia(iso, C.horarios);
      if (!rangos.length) return null;
      const pac = opts.pac || siguientePac();
      const t = opts.trat ? lista.find((x) => x.id === opts.trat) : pick(bolsa);
      const cands = [];
      for (const [a, b] of rangos) {
        for (let m = toMin(a); m + t.duracion <= toMin(b); m += 30) {
          if (opts.soloFuturo && offset === 0 && m < minAhora + 30) continue;
          if (opts.soloPasado && offset === 0 && m + t.duracion > minAhora) continue;
          for (const p of t.profesionales) if (!estaOcupado(ctx, p, iso, m, m + t.duracion)) cands.push({ m, p });
        }
      }
      if (!cands.length) return null;
      const c = pick(cands);
      const pro = profesional(c.p);
      const pasado = offset < 0 || (offset === 0 && c.m + t.duracion <= minAhora);
      let estado = opts.estado || (pasado ? "atendido" : "confirmado");
      const web = opts.origen ? opts.origen === "web" : R() < 0.6;
      const creado = opts.creado || new Date(addDays(base, offset - 2 - Math.floor(R() * 10)).getTime() + (9 + Math.floor(R() * 11)) * 3600000);
      const turno = {
        id: "t" + (ts.length + 1),
        codigo: codigo(),
        creado: creado.toISOString(),
        origen: web ? "web" : "manual",
        pacienteId: pac.id,
        paciente: pac.nombre,
        whatsapp: pac.whatsapp,
        email: pac.email,
        obraSocial: pac.obraSocial,
        primeraVez: false,
        tratamientoId: t.id,
        tratamiento: t.nombre,
        profesionalId: pro.id,
        profesional: pro.nombre,
        fecha: iso,
        hora: toHHMM(c.m),
        duracion: t.duracion,
        estado,
        comentario: web ? pick(COMENTARIOS) : ""
      };
      ts.push(turno);
      return turno;
    }

    function repetir(n, desde, hasta, opts) {
      let hechos = 0, intentos = 0;
      while (hechos < n && intentos < n * 12) {
        intentos++;
        const off = desde + Math.floor(R() * (hasta - desde + 1));
        const o = typeof opts === "function" ? opts(hechos) : opts;
        if (agendar(off, o)) hechos++;
      }
    }

    // Historial (últimos 2 meses) para que los pacientes tengan visitas.
    repetir(8, -60, -36, (i) => ({ estado: i === 4 ? "ausente" : "atendido" }));
    for (let w = 0; w < 4; w++) repetir(3, -35 + w * 7, -29 + w * 7, (i) => ({ estado: w === 2 && i === 1 ? "ausente" : "atendido" }));
    // Semana pasada.
    repetir(12, -7, -1, (i) => ({ estado: i === 3 || i === 9 ? "ausente" : i === 6 ? "cancelado" : "atendido" }));
    // Hoy: algunos ya atendidos y otros por venir.
    repetir(3, 0, 0, (i) => ({ soloPasado: true, estado: i === 2 ? "ausente" : "atendido" }));
    repetir(3, 0, 0, (i) => ({ soloFuturo: true, estado: i === 1 ? "nuevo" : "confirmado", origen: i === 1 ? "web" : undefined }));
    // Próximas 2 semanas (incluye nuevos desde la web, sin confirmar).
    repetir(4, 1, 6, () => ({ estado: "nuevo", origen: "web", creado: new Date(Date.now() - (1 + Math.floor(R() * 20)) * 3600000) }));
    repetir(16, 1, 6, (i) => ({ estado: i === 8 ? "cancelado" : "confirmado" }));
    repetir(10, 7, 14, { estado: "confirmado" });
    // La nena, con odontopediatría.
    agendar(-35, { pac: nina, trat: "odontopediatria", estado: "atendido" });
    repetir(1, 2, 12, { pac: nina, trat: "odontopediatria", estado: "confirmado" });

    // "Primera vez": el primer turno de algunos pacientes.
    ts.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    const vistos = new Set();
    ts.forEach((t) => {
      if (!vistos.has(t.pacienteId)) { vistos.add(t.pacienteId); t.primeraVez = R() < 0.6; }
      if (t.estado === "nuevo") t.primeraVez = t.primeraVez || R() < 0.4;
    });
    ts.forEach((t, i) => { t.id = "t" + (i + 1); });

    // Pagos de ejemplo.
    const pgs = [];
    const medios = C.panel.mediosDePago;
    const pago = (t, monto, estado, fecha) => pgs.push({
      id: "pg" + (pgs.length + 1), fecha: fecha || t.fecha, creado: new Date().toISOString(),
      pacienteId: t.pacienteId, paciente: t.paciente, turnoId: t.id, tratamiento: t.tratamiento,
      monto: Math.round(monto / 1000) * 1000, medio: estado === "pendiente" ? "" : pick(medios), estado
    });
    ts.forEach((t) => {
      const tr = lista.find((x) => x.id === t.tratamientoId);
      if (t.estado === "atendido") {
        if (tr.id === "consulta" && t.primeraVez) return; // primera evaluación sin cargo
        if (tr.precio > 500000) { pago(t, tr.precio * 0.3, "seña", toISO(addDays(parseISO(t.fecha), -7))); pago(t, tr.precio * 0.7, "pendiente"); return; }
        if (R() < 0.15) pago(t, tr.precio, "pendiente");
        else pago(t, tr.precio, "pagado");
      } else if (t.estado === "confirmado" && tr.precio >= 200000 && t.fecha > hoyISO()) {
        const f = toISO(addDays(base, -Math.floor(R() * 4)));
        pago(t, tr.precio * 0.3, "seña", f);
      }
    });

    return { pacientes: pacs, turnos: ts, pagos: pgs, bloqueos: bloqs };
  }

  function cargarEjemplo() {
    const d = generarEjemplo();
    try { Object.values(KEYS).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
    Object.keys(mem).forEach((k) => delete mem[k]);
    write(KEYS.pacientes, d.pacientes);
    write(KEYS.pagos, d.pagos);
    write(KEYS.bloqueos, d.bloqueos);
    write(KEYS.turnos, d.turnos);
    write(KEYS.seed, SEED_VERSION);
  }

  function init() { if (read(KEYS.seed, null) !== SEED_VERSION) cargarEjemplo(); }

  /* -------------------------------------------------------------- export */
  window.Lumen = {
    config: C,
    util: { pad, toISO, parseISO, addDays, hoy, hoyISO, toMin, toHHMM, DIAS, DIAS_CORTO, MESES, diffDias, fmtDia, fmtDiaLargo, cuando, money, uid, esc, primerNombre, iniciales, fill, normalizarTel, telVisible, waLink, abrirWhatsApp, burbujaWA, vistaPreviaWhatsApp },
    store: {
      init, reiniciar: cargarEjemplo, on,
      ajustes, guardarAjustes,
      tratamientos, tratamiento, profesionales, profesional, profesionalesPara,
      turnos, turno, crearTurno, actualizarTurno,
      pacientes, paciente, buscarOCrearPaciente, guardarPaciente,
      pagos, crearPago, actualizarPago, eliminarPago,
      bloqueos, crearBloqueo, eliminarBloqueo,
      feriado, rangosDelDia, horariosLibres, dias,
      datosMensaje, mensaje
    }
  };
  init();
})();
