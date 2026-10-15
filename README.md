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

## Probar

    node tests/test.js      # 77 pruebas de unidades, geometría y modelo 3D
    python3 -m http.server  # y abre http://localhost:8000

## Publicar como sitio aparte

Es estático, sin build. GitHub Pages (Settings > Pages > main / root; repo público en plan gratis),
o Netlify / Vercel arrastrando la carpeta (sirven con repo privado).

## Lo que sigue

Cuartos con área en 2D · láminas e impresión con cajetín · PDF a escala y DXF · offset, recortar y escalar ·
biblioteca de muebles · cómputo de materiales · plantillas · compartir por enlace · cuentas y nube ·
varios pisos, escaleras y techos.
