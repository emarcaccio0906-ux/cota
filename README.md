# Trazo

Editor de planos 2D en el navegador, pensado para estudiantes, contratistas, diseñadores y gente que dibuja por gusto.
Funciona con mouse en computadora y con dedo o Apple Pencil en iPad. No necesita instalación ni servidor:
abre `index.html` o publícalo tal cual (GitHub Pages, Netlify, Vercel).

## Lo que ya hace (prototipo, fases 1 y 2)

- Lienzo con zoom y movimiento (rueda, Espacio+arrastrar, dos dedos en iPad)
- Línea, polilínea, rectángulo, círculo, pared con espesor, puerta, ventana y cota
- Snap a cuadrícula, extremos y puntos medios; modo ortogonal (Shift u "Orto")
- Medidas exactas escritas: `12'6"`, `3.5m`, `150cm`, `12<45` (largo y ángulo), `ancho,alto`
- Pies-pulgadas o metros, con el mismo dibujo
- Elegir, mover (arrastrar), elegir por ventana, duplicar, girar 90°, borrar
- Capas con color, ocultar y bloquear; propiedades editables
- Deshacer/rehacer, autoguardado en el navegador, guardar/abrir `.json`, exportar PNG
- Tema oscuro y claro

## Lo que sigue

Offset, recortar y escalar · bloques de muebles · cuartos con área automática · exportar PDF a escala y DXF ·
vista 3D (Three.js) · cuentas de usuario y guardado en la nube · plan gratis y plan pago.

## Estructura

```
index.html        página
css/styles.css    interfaz y temas
js/units.js       lectura y formato de medidas (pura, con pruebas)
js/geom.js        geometría, enganche y colocación de aberturas (pura, con pruebas)
js/app.js         editor: lienzo, herramientas, capas, archivos
tests/test.js     pruebas de la lógica pura
```

## Pruebas

```
node tests/test.js
```

Todo el dibujo se guarda en metros con Y hacia arriba. Un plano guardado es un `.json` legible.
