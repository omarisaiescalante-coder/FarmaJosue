
(function (raiz, fabrica) {
    if (typeof module === 'object' && module.exports) {
        module.exports = fabrica();
    } else {
        raiz.CalculosVenta = fabrica();
    }
})(typeof self !== 'undefined' ? self : this, function () {

    // Configuración de impuestos y descuentos
    const TASA_ISV = 15;
    const EDAD_TERCERA = 60;
    const DESCUENTO_TERCERA = 25;

    // Formatear DNI
    function formatearDni(valor) {
        const d = String(valor ?? '').replace(/\D/g, '').slice(0, 13);

        return [
            d.slice(0, 4),
            d.slice(4, 8),
            d.slice(8)
        ].filter(Boolean).join('-');
    }

    // Validar DNI
    function dniValido(dni, hoy = new Date()) {
        const m = /^(\d{4})-(\d{4})-(\d{5})$/.exec(String(dni ?? ''));

        if (!m) return false;

        const depto = Number(m[1].slice(0, 2));
        const muni = Number(m[1].slice(2, 4));
        const anio = Number(m[2]);

        return depto >= 1 &&
            depto <= 18 &&
            muni >= 1 &&
            anio >= 1900 &&
            anio <= hoy.getFullYear();
    }

    // Calcular edad aproximada a partir del año de nacimiento del DNI
    function edadDesdeDni(dni, hoy = new Date()) {
        if (!dniValido(dni, hoy)) return null;

        return hoy.getFullYear() - Number(String(dni).slice(5, 9));
    }

    // Único descuento: tercera edad, a partir de los 60 años
    function porcentajeDescuento(edad) {
        if (
            edad === null ||
            edad === undefined ||
            edad === '' ||
            !Number.isFinite(Number(edad))
        ) {
            return 0;
        }

        return Number(edad) >= EDAD_TERCERA
            ? DESCUENTO_TERCERA
            : 0;
    }

    function nombreDescuento(porcentaje) {
        return porcentaje === DESCUENTO_TERCERA
            ? 'tercera edad'
            : '';
    }

    // Calcular subtotal, descuento, ISV y total
    function calcularVenta(lineas, edad) {
        const porcentaje = porcentajeDescuento(edad);

        let subtotal = 0;
        let descuento = 0;
        let isv = 0;

        for (const linea of lineas) {
            if (
                !Number.isSafeInteger(linea.precio) ||
                linea.precio < 0 ||
                !Number.isSafeInteger(linea.cantidad) ||
                linea.cantidad < 1
            ) {
                throw new Error('Precio o cantidad inválida.');
            }

            const importe = linea.precio * linea.cantidad;

            // Aplicar descuento únicamente a personas de 60 años o más
            const rebaja = Math.round(
                importe * porcentaje / 100
            );

            subtotal += importe;
            descuento += rebaja;

            // Calcular ISV después del descuento, si corresponde
            isv += linea.aplicaIsv
                ? Math.round(
                    (importe - rebaja) * TASA_ISV / 100
                )
                : 0;

            if (
                ![
                    subtotal,
                    descuento,
                    isv,
                    subtotal - descuento + isv
                ].every(Number.isSafeInteger)
            ) {
                throw new Error(
                    'El total excede el máximo permitido.'
                );
            }
        }

        return {
            subtotal,
            descuento,
            isv,
            total: subtotal - descuento + isv,
            porcentajeDescuento: porcentaje
        };
    }

    // Calcular cambio
    function calcularCambio(total, recibido) {
        if (
            ![total, recibido].every(
                n => Number.isSafeInteger(n) && n >= 0
            )
        ) {
            throw new Error('Importe de pago inválido.');
        }

        return {
            suficiente: recibido >= total,
            cambio: Math.max(0, recibido - total),
            faltante: Math.max(0, total - recibido)
        };
    }

    return {
        TASA_ISV,
        formatearDni,
        dniValido,
        edadDesdeDni,
        porcentajeDescuento,
        nombreDescuento,
        calcularVenta,
        calcularCambio
    };
});
