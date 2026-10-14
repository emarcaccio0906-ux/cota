/* Cota — unidades: lectura y formato de medidas.
 * Todo el dibujo se guarda en METROS. Aquí se convierte de/hacia pies-pulgadas y metros.
 * Funciona en el navegador (window.CotaUnits) y en Node (require) para las pruebas. */
(function (root) {
  'use strict';

  var FT = 0.3048;
  var IN = 0.0254;

  var NUM = '(\\d+(?:\\.\\d+)?)';

  /** Lee una medida escrita por el usuario y la devuelve en metros (NaN si no se entiende).
   *  Acepta: 12'6"  12'-6 1/2"  12ft  6in  6"  3.5m  150cm  1500mm  y números sueltos
   *  (un número suelto se interpreta en la unidad que se esté mostrando: 'ft' o 'm'). */
  function parseLength(input, displayUnit) {
    if (input == null) return NaN;
    var s = String(input).trim().toLowerCase()
      .replace(/[”″“]/g, '"').replace(/[’′‘]/g, "'");
    if (!s) return NaN;

    var sign = 1;
    if (s[0] === '-') { sign = -1; s = s.slice(1).trim(); }
    else if (s[0] === '+') { s = s.slice(1).trim(); }

    var m;

    // pies y pulgadas: 12'6"  12'-6"  12' 6 1/2"  12ft 6in  12ft
    m = s.match(new RegExp('^' + NUM + "\\s*(?:'|ft|feet|foot)\\s*-?\\s*(?:" + NUM + '(?:\\s+(\\d+)\\/(\\d+))?\\s*(?:"|in|inch|inches)?)?$'));
    if (m) {
      var inch = m[2] ? parseFloat(m[2]) : 0;
      if (m[3] && m[4] && parseFloat(m[4]) !== 0) inch += parseFloat(m[3]) / parseFloat(m[4]);
      return sign * (parseFloat(m[1]) * 12 + inch) * IN;
    }

    // solo pulgadas, con fracción opcional: 6"  6 1/2"  3/4"
    m = s.match(new RegExp('^(?:' + NUM + '\\s+)?(?:(\\d+)\\/(\\d+)|' + NUM + ')?\\s*(?:"|in|inch|inches)$'));
    if (m) {
      var whole = m[1] ? parseFloat(m[1]) : 0;
      var frac = (m[2] && m[3] && parseFloat(m[3]) !== 0) ? parseFloat(m[2]) / parseFloat(m[3]) : 0;
      var plain = m[4] ? parseFloat(m[4]) : 0;
      var total = whole + frac + plain;
      if (!m[1] && !m[2] && !m[4]) return NaN;
      return sign * total * IN;
    }

    m = s.match(new RegExp('^' + NUM + '\\s*mm$'));
    if (m) return sign * parseFloat(m[1]) / 1000;
    m = s.match(new RegExp('^' + NUM + '\\s*cm$'));
    if (m) return sign * parseFloat(m[1]) / 100;
    m = s.match(new RegExp('^' + NUM + '\\s*(?:m|mt|mts|meter|meters|metro|metros)$'));
    if (m) return sign * parseFloat(m[1]);

    // número suelto: unidad que se muestra
    m = s.match(new RegExp('^' + NUM + '$'));
    if (m) return sign * parseFloat(m[1]) * (displayUnit === 'ft' ? FT : 1);

    return NaN;
  }

  function trimZeros(str) {
    return str.indexOf('.') >= 0 ? str.replace(/0+$/, '').replace(/\.$/, '') : str;
  }

  /** Pies-pulgadas estilo plano arquitectónico: 12'-6 1/2" (redondea a 1/16"). */
  function formatFtIn(meters) {
    var sign = meters < 0 ? '-' : '';
    var inches = Math.round(Math.abs(meters) / IN * 16) / 16;
    var ft = Math.floor(inches / 12 + 1e-9);
    var rem = inches - ft * 12;
    var whole = Math.floor(rem + 1e-9);
    var frac = Math.round((rem - whole) * 16);
    if (frac === 16) { whole += 1; frac = 0; }
    if (whole === 12) { ft += 1; whole = 0; }

    var fracStr = '';
    if (frac) {
      var n = frac, d = 16;
      while (n % 2 === 0) { n /= 2; d /= 2; }
      fracStr = n + '/' + d;
    }
    var inchPart = (whole ? String(whole) : '') + (fracStr ? (whole ? ' ' : '') + fracStr : '');
    if (!inchPart) inchPart = '0';

    if (ft === 0) return sign + inchPart + '"';
    return sign + ft + "'-" + inchPart + '"';
  }

  function formatMeters(meters) {
    var v = Math.abs(meters);
    var out = trimZeros(v.toFixed(3));
    if (v >= 1) out = trimZeros(v.toFixed(2));
    return (meters < 0 ? '-' : '') + out + ' m';
  }

  function formatLength(meters, displayUnit) {
    return displayUnit === 'ft' ? formatFtIn(meters) : formatMeters(meters);
  }

  /** Área: pies² o m². */
  function formatArea(sqMeters, displayUnit) {
    if (displayUnit === 'ft') return trimZeros((sqMeters / (FT * FT)).toFixed(1)) + ' ft²';
    return trimZeros(sqMeters.toFixed(2)) + ' m²';
  }

  /** Coordenada corta para la barra de estado. */
  function formatCoord(meters, displayUnit) {
    if (displayUnit === 'ft') return trimZeros((meters / FT).toFixed(2)) + "'";
    return trimZeros(meters.toFixed(3)) + ' m';
  }

  var api = {
    FT: FT, IN: IN,
    parseLength: parseLength,
    formatLength: formatLength,
    formatFtIn: formatFtIn,
    formatMeters: formatMeters,
    formatArea: formatArea,
    formatCoord: formatCoord
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CotaUnits = api;
})(this);
