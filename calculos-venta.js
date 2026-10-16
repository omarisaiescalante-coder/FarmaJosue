// Reglas de cálculo del módulo de ventas.
// Se usa tanto en la pantalla (navegador) como en el servidor (Node), para que
// ambos calculen exactamente lo mismo. Todos los importes van en CENTAVOS (enteros).
(function (raiz, fabrica) {
    if (typeof module === 'object' && module.exports) module.exports = fabrica();
    else raiz.CalculosVenta = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
    // ---- Reglas configurables ------------------------------------------------
    const TASA_ISV = 15;            // % de ISV
    const EDAD_TERCERA = 60;        // desde esta edad: tercera edad
    const EDAD_CUARTA = 80;         // desde esta edad: cuarta edad (AJUSTAR si el criterio es otro)
    const DESCUENTO_TERCERA = 25;   // %
    const DESCUENTO_CUARTA = 30;    // %

    // ---- DNI -----------------------------------------------------------------
    // Deja solo dígitos (máx. 13) y los agrupa como 0000-0000-00000.
    function formatearDni(valor) {
        const d = String(valor ?? '').replace(/\D/g, '').slice(0, 13);
        return [d.slice(0, 4), d.slice(4, 8), d.slice(8)].filter(Boolean).join('-');
    }
    // Estructura: 2 dígitos de departamento (01-18), 2 de municipio, año de nacimiento y 5 de secuencia.
    function dniValido(dni, hoy = new Date()) {
        const m = /^(\d{2})(\d{2})-(\d{4})-(\d{5})$/.exec(String(dni ?? ''));
        if (!m) return false;
        const depto = Number(m[1]), muni = Number(m[2]), anio = Number(m[3]);
        return depto >= 1 && depto <= 18 && muni >= 1 && anio >= 1900 && anio <= hoy.getFullYear();
    }
    // El año de nacimiento va dentro del DNI: sirve para estimar la edad.
    function edadDesdeDni(dni, hoy = new Date()) {
        if (!dniValido(dni, hoy)) return null;
        return hoy.getFullYear() - Number(String(dni).slice(5, 9));
    }

    // ---- Descuento por edad (nunca se acumulan: se aplica uno solo) -----------
    function porcentajeDescuento(edad) {
        if (edad === null || edad === undefined || edad === '' || !Number.isFinite(Number(edad))) return 0;
        const e = Number(edad);
        if (e >= EDAD_CUARTA) return DESCUENTO_CUARTA;
        if (e >= EDAD_TERCERA) return DESCUENTO_TERCERA;