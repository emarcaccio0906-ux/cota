# Cota

Editor de planos 2D en el navegador, pensado para estudiantes, contratistas, diseñadores y gente que dibuja por gusto.
Funciona con mouse en computadora y con dedo o Apple Pencil en iPad. No necesita instalación ni servidor:
abre `index.html` o publícalo tal cual (GitHub Pages, Netlify, Vercel).

## Lo que ya hace (prototipo, fases 1 y 2)

- Lienzo con zoom y movimiento (rueda, Espacio+arrastrar, dos dedos en iPad)
- Línea, polilínea, rectángulo, círculo, pared con espesor, puerta, ventana y cota
- Snap a cuadrícula, extremos y puntos medios; modo ortogonal (Shift u "Orto") y ángulo polar (15°, 30°, 45°, 90°)
- Cuadrícula a tu medida: espaciado fijo o automático (1", 4", 16", 1', 4'... o el que escribas), líneas gruesas cada N, paso del snap propio y precisión de las medidas (hasta 1/16")
- Medidas comunes de obra para paredes (interior, exterior, bloque), puertas y ventanas
- Medidas exactas escritas: `12'6"`, `3.5m`, `150cm`, `12<45` (largo y ángulo), `ancho,alto`
- Pies-pulgadas o metros, con el mismo dibujo
- Elegir, mover (arrastrar), elegir por ventana, duplicar, girar 90°, borrar
- Capas con color, ocultar y bloquear; propiedades editables
- Deshacer/rehacer, autoguardado en el navegador, guardar/abrir `.json`, exportar PNG
- Tema oscuro y claro

## Vista 3D (fase 3)

- Un clic en **3D** y el plano se levanta: paredes con dinteles, puertas con hoja abierta, ventanas con marco y vidrio
- Cámaras: órbita, planta y recorrido a altura de persona (toca el piso para caminar, WASD o flechas)
- Sol por hora del día con sombras, materiales de pared y piso, techo opcional, corte de paredes a 4' o solo bases
- Piso y cuartos detectados solos (áreas de espacios cerrados)
- Exportar la vista 3D como PNG
- Three.js r128 viene incluido en `vendor/` (MIT), no necesita internet

## Fase 4: muebles, cuartos, plantillas y pisos

- **Muebles**: biblioteca de más de 20 piezas (cama, sofá, mesa, cocina, baño, escalera, carro...), con símbolo en 2D y modelo en 3D. Se pegan solos a la pared; **R** o "Girar 90°" los gira
- **Cuartos**: herramienta Cuarto para ponerles nombre; el área se calcula sola y se muestra en el plano (se puede apagar)
- **Plantillas**: en blanco, estudio, apartamento, casa, casa de dos pisos y garaje
- **Varios pisos**: niveles con escaleras (el hueco se abre en el piso de arriba), techo plano o a dos aguas, selector "Ver" en 3D y recorrido que sube escaleras
- **Proyectos**: varios planos guardados en el navegador con miniatura; duplicar, abrir y borrar
- **Plan gratis**: 3 proyectos y 2 pisos. Hay "modo de pruebas" para quitar los límites mientras se prueba. Cuentas y nube necesitan un backend y todavía no existen

## Modo clase: dibujo técnico como en papel

- Dos formas de trabajar arriba: **Clase** (hoja de papel para las tareas) y **Libre** (diseño de interiores, muebles y 3D)
- Hojas 18×24 (Arch C), 11×17, 24×36 y carta, horizontal o vertical, con marco y cajetín (proyecto, nombre, curso, fecha, escala, lámina)
- Escalas del escalímetro de arquitecto: 3/32", 1/8", 3/16", 1/4", 3/8", 1/2", 3/4", 1", 1 1/2", 3" = 1'-0" y tamaño real; en métrico 1:1 a 1:500
- Cuadrícula medida en el papel (1/16", 1/8", 1/4", 1/2", 1", 1/10") o en la obra (1", 6", 1', 16"...), cuadrada o isométrica a 30°, con snap por cuadro, medio o cuarto
- Minas 4H, 2H, H, F, HB, B y 2B con su grosor y tono, y el alfabeto de líneas: visible, contorno, oculta, eje, cota, construcción, corte y proyección
- Escuadras que se mueven sobre la hoja: regla T, 30°-60°, 45° y escalímetro con sus marcas. El lápiz se pega al canto y sigue su ángulo; se giran de 15° en 15° o se voltean
- Cada línea dice cuánto mide real y cuánto en el papel (12'-0" · 3" en papel)
- Texto en letra de plano (3/32" a 1/2")
- Plantillas de clase: hoja en blanco, alfabeto de líneas, planta, elevación frontal, vistas ortogonales e isométrico
- PNG de la hoja e Imprimir a escala (imprime al 100%)

## Probar

    node tests/test.js      # 77 pruebas de unidades, geometría y modelo 3D
    node tests/test2.js     # 28 pruebas de muebles, cuartos, escaleras y plantillas
    node tests/test3.js     # 12 pruebas de escalas, hojas, isométrico, escuadras y plantillas de clase
    python3 -m http.server  # y abre http://localhost:8000

## Publicar como sitio aparte

Es estático, sin build. GitHub Pages (Settings > Pages > main / root; repo público en plan gratis),
o Netlify / Vercel arrastrando la carpeta (sirven con repo privado).

## Lo que sigue

Láminas e impresión con cajetín · PDF a escala y DXF · offset, recortar y escalar ·
cómputo de materiales · compartir por enlace · cuentas y nube.
