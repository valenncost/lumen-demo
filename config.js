/* =========================================================================
   LUMEN ODONTOLOGÍA · CONFIGURACIÓN
   -------------------------------------------------------------------------
   Todo lo que el consultorio puede querer cambiar está acá: nombre,
   dirección, WhatsApp, horarios, tratamientos, precios, profesionales,
   preguntas frecuentes y textos de los mensajes.

   - Editá solo los valores (lo que está entre comillas o los números).
   - No borres las comas ni las llaves.
   - Algunas cosas (horarios, duraciones, WhatsApp y mensajes) también se
     pueden cambiar desde el panel → Ajustes. Lo que se guarde ahí tiene
     prioridad sobre este archivo (y se borra con "Reiniciar demo").
   ========================================================================= */

window.LUMEN_CONFIG = {

  /* ---------- Modo demo ----------
     true  = demo para mostrar: no se abre WhatsApp, se ve cómo quedaría el mensaje.
     false = consultorio real: los botones abren WhatsApp de verdad. */
  modoDemo: true,

  /* ---------- Datos del consultorio ---------- */
  consultorio: {
    nombre: "Lumen Odontología",
    ciudad: "Bahía Blanca",
    direccion: "Av. Alem 1200",
    direccionCompleta: "Av. Alem 1200, Bahía Blanca, Buenos Aires",
    // WhatsApp de la secretaria: código de país + área + número, sin espacios ni "+".
    whatsapp: "5492910000000",
    whatsappVisible: "+54 9 291 000-0000",
    instagram: "lumen.odontologia",
    email: "hola@lumenodontologia.com.ar",
    // Texto que se muestra en la web (los horarios reales de turnos están más abajo).
    horariosTexto: ["Lun a Vie · 9 a 20 hs", "Sáb · 9 a 13 hs"],
    // Lo que se busca en Google Maps para el mapa embebido.
    mapa: "Bahía Blanca, Buenos Aires, Argentina"
  },

  /* ---------- Horarios para sacar turno ----------
     Un rango por día (o varios, ej: [["09:00","13:00"],["15:00","20:00"]]).
     0 = domingo, 1 = lunes ... 6 = sábado. Lista vacía = cerrado. */
  horarios: {
    0: [],
    1: [["09:00", "20:00"]],
    2: [["09:00", "20:00"]],
    3: [["09:00", "20:00"]],
    4: [["09:00", "20:00"]],
    5: [["09:00", "20:00"]],
    6: [["09:00", "13:00"]]
  },

  turnos: {
    intervalo: 30,          // cada cuántos minutos se ofrece un horario
    diasAnticipacion: 21,   // cuántos días para adelante se puede reservar (3 semanas)
    margenMinutos: 60       // para hoy, no ofrecer horarios que empiecen en menos de X minutos
  },

  /* ---------- Feriados (días sin turnos) ----------
     Formato AAAA-MM-DD. */
  feriados: [
    { fecha: "2026-10-12", nombre: "Día de la Diversidad Cultural" },
    { fecha: "2026-11-23", nombre: "Día de la Soberanía Nacional" },
    { fecha: "2026-12-08", nombre: "Inmaculada Concepción" },
    { fecha: "2026-12-25", nombre: "Navidad" },
    { fecha: "2027-01-01", nombre: "Año Nuevo" }
  ],

  /* ---------- Profesionales ----------
     "articulo" se usa en los mensajes: "con la Dra. Ferraro". */
  profesionales: [
    {
      id: "ferraro",
      nombre: "Dra. Julieta Ferraro",
      corto: "Dra. Ferraro",
      articulo: "la Dra. Ferraro",
      iniciales: "JF",
      especialidad: "Implantes y rehabilitación oral",
      bio: "Especialista en implantología. Planifica cada caso con estudios digitales para que sepas desde el primer día cómo va a ser tu tratamiento.",
      etiquetas: ["Implantes", "Prótesis", "Cirugía"]
    },
    {
      id: "sosa",
      nombre: "Dr. Martín Sosa",
      corto: "Dr. Sosa",
      articulo: "el Dr. Sosa",
      iniciales: "MS",
      especialidad: "Ortodoncia y estética dental",
      bio: "Trabaja con brackets y alineadores invisibles. Le dedica tiempo a explicar cada paso para que te sientas cómodo durante todo el proceso.",
      etiquetas: ["Ortodoncia", "Estética", "Niños"]
    }
  ],

  /* ---------- Categorías de tratamientos (pastillas de filtro) ---------- */
  categorias: ["General", "Estética", "Implantes", "Niños"],

  /* ---------- Tratamientos ----------
     duracion: en minutos.
     precio: valor de referencia en pesos (se usa en el panel al registrar cobros).
     profesionales: quiénes lo hacen (ids de arriba).
     icono: consulta | limpieza | caries | endodoncia | cirugia | implante |
            rehabilitacion | corona | blanqueamiento | estetica | ortodoncia | ninos */
  mostrarPrecios: false, // true = muestra "Desde $..." en las tarjetas de la web
  tratamientos: [
    { id: "consulta",       nombre: "Consulta y evaluación",           categoria: "General",   duracion: 30, precio: 25000,   icono: "consulta",       profesionales: ["ferraro", "sosa"], descripcion: "Revisamos tu caso y te mostramos las opciones." },
    { id: "limpieza",       nombre: "Limpieza dental",                 categoria: "General",   duracion: 45, precio: 45000,   icono: "limpieza",       profesionales: ["ferraro", "sosa"], descripcion: "Limpieza profunda y control para prevenir problemas." },
    { id: "arreglos",       nombre: "Arreglos (caries)",               categoria: "General",   duracion: 45, precio: 55000,   icono: "caries",         profesionales: ["ferraro", "sosa"], descripcion: "Restauraciones estéticas del color de tu diente." },
    { id: "endodoncia",     nombre: "Endodoncia",                      categoria: "General",   duracion: 60, precio: 180000,  icono: "endodoncia",     profesionales: ["ferraro"],         descripcion: "Tratamiento de conducto para salvar tu pieza." },
    { id: "cirugia",        nombre: "Cirugía y extracciones",          categoria: "General",   duracion: 60, precio: 120000,  icono: "cirugia",        profesionales: ["ferraro"],         descripcion: "Diagnóstico y cirugía oral, simple y segura." },
    { id: "implante",       nombre: "Implante unitario",               categoria: "Implantes", duracion: 60, precio: 950000,  icono: "implante",       profesionales: ["ferraro"],         descripcion: "Reemplazá una pieza perdida con una solución fija." },
    { id: "rehabilitacion", nombre: "Rehabilitación sobre implantes",  categoria: "Implantes", duracion: 90, precio: 3200000, icono: "rehabilitacion", profesionales: ["ferraro"],         descripcion: "Volvé a comer, hablar y sonreír cuando faltan varias piezas." },
    { id: "protesis",       nombre: "Prótesis y coronas",              categoria: "Implantes", duracion: 60, precio: 420000,  icono: "corona",         profesionales: ["ferraro"],         descripcion: "Coronas de zirconio, porcelana (CAD-CAM) o metalocerámica." },
    { id: "blanqueamiento", nombre: "Blanqueamiento",                  categoria: "Estética",  duracion: 60, precio: 220000,  icono: "blanqueamiento", profesionales: ["sosa"],            descripcion: "Sacá manchas de café, mate, vino o cigarrillo." },
    { id: "estetica",       nombre: "Estética dental",                 categoria: "Estética",  duracion: 60, precio: 350000,  icono: "estetica",       profesionales: ["sosa"],            descripcion: "Carillas y diseño de sonrisa." },
    { id: "ortodoncia",     nombre: "Ortodoncia",                      categoria: "Estética",  duracion: 45, precio: 90000,   icono: "ortodoncia",     profesionales: ["sosa"],            descripcion: "Brackets o alineadores invisibles para corregir la posición." },
    { id: "odontopediatria",nombre: "Odontopediatría",                 categoria: "Niños",     duracion: 30, precio: 35000,   icono: "ninos",          profesionales: ["sosa"],            descripcion: "Atención pensada para que los chicos vengan tranquilos." }
  ],

  /* ---------- "Soluciones según tu necesidad" (las 3 tarjetas con foto) ---------- */
  soluciones: [
    { titulo: "Me falta un diente",        texto: "Reemplazo fijo, funcional y estético con implante unitario.",                     foto: "img/implante.webp",       tratamiento: "implante" },
    { titulo: "Me faltan varias piezas",   texto: "Recuperá la mordida y la estabilidad con rehabilitación sobre implantes.",        foto: "img/rehabilitacion.webp", tratamiento: "rehabilitacion" },
    { titulo: "Quiero mejorar mi sonrisa", texto: "Blanqueamiento y estética dental para una sonrisa más linda.",                    foto: "img/sonrisa.webp",        tratamiento: "blanqueamiento" }
  ],

  /* ---------- Galería "El consultorio" (6 fotos) ---------- */
  galeria: [
    { foto: "img/consultorio-1.webp", texto: "Box de atención" },
    { foto: "img/consultorio-3.webp", texto: "Sala con luz natural" },
    { foto: "img/recepcion.webp",     texto: "Recepción" },
    { foto: "img/consultorio-2.webp", texto: "Sillón y equipamiento" },
    { foto: "img/sillon.webp",        texto: "Box de estética" },
    { foto: "img/detalle.webp",       texto: "Detalles que cuidamos" }
  ],

  /* ---------- Obras sociales ---------- */
  obrasSociales: ["OSDE", "Swiss Medical", "Galeno", "Medifé", "Sancor Salud", "Particular"],

  /* ---------- Opiniones (de ejemplo) ---------- */
  opiniones: [
    { nombre: "Carolina M.", tratamiento: "Implante unitario", estrellas: 5, texto: "Tenía mucho miedo y me explicaron todo con paciencia. Hoy como de todo y ni me acuerdo que tengo un implante." },
    { nombre: "Diego R.",    tratamiento: "Limpieza dental",   estrellas: 5, texto: "Saqué el turno desde el celu a la noche y a la mañana ya me habían confirmado. Súper puntuales." },
    { nombre: "Lucía P.",    tratamiento: "Blanqueamiento",    estrellas: 5, texto: "El consultorio es hermoso y muy luminoso. El resultado fue natural, justo lo que buscaba." },
    { nombre: "Ricardo F.",  tratamiento: "Odontopediatría",   estrellas: 5, texto: "Mi hijo salió contento y quiere volver. Eso con un dentista es mucho decir." }
  ],

  /* ---------- Preguntas frecuentes ---------- */
  preguntas: [
    { p: "¿La primera consulta tiene costo?", r: "No, la primera evaluación es sin cargo." },
    { p: "¿Atienden obras sociales?",         r: "Sí, trabajamos con las principales. Consultanos por la tuya." },
    { p: "¿Cómo cancelo o cambio mi turno?",  r: "Desde el link que te llega por WhatsApp, o escribiéndonos." },
    { p: "¿Atienden urgencias?",              r: "Sí, escribinos por WhatsApp y te damos el primer turno disponible." },
    { p: "¿Cuánto dura un implante?",         r: "Con buenos cuidados, muchos años. En la consulta te explicamos todo." },
    { p: "¿Cómo se paga?",                    r: "Efectivo, transferencia, tarjeta o Mercado Pago." }
  ],

  /* ---------- Panel del consultorio ---------- */
  panel: {
    pin: "1234",                 // PIN de ingreso (demo)
    usuario: "Dra. Ferraro",     // aparece en el saludo: "Buen día, Dra. Ferraro"
    mediosDePago: ["Efectivo", "Transferencia", "Tarjeta", "Mercado Pago"]
  },

  /* ---------- Textos de los mensajes de WhatsApp ----------
     Podés usar: {nombre} {tratamiento} {dia} {hora} {cuando}
                 {profesional} {direccion} {codigo} {consultorio} */
  mensajes: {
    confirmacion: "Hola {nombre}! Te confirmamos tu turno de {tratamiento} el {dia} a las {hora} con {profesional} en {direccion}. Cualquier cosa escribinos. ¡Te esperamos! 🦷",
    recordatorio: "Hola {nombre}! Te recordamos tu turno de {tratamiento} {cuando} a las {hora} con {profesional} en {direccion}. Si no podés venir, avisanos por acá así le damos el lugar a otro paciente. 🦷",
    reprogramar:  "Hola {nombre}! Te escribimos de {consultorio} por tu turno de {tratamiento} del {dia} a las {hora}. Ese horario no lo vamos a poder mantener 🙏 ¿Coordinamos otro día? Decinos qué días y horarios te quedan cómodos."
  }
};
