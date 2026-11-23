(function (root) {
    const fechaLocal = dia => `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;

    function sumarMeses(fecha, meses) {
        const destino = new Date(fecha.getFullYear(), fecha.getMonth() + meses, 1);
        const ultimoDia = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
        destino.setDate(Math.min(fecha.getDate(), ultimoDia));
        return fechaLocal(destino);
    }

    function limitesFechasLote(hoy = new Date()) {
        return { hoy: fechaLocal(hoy), fabricacionMin: sumarMeses(hoy, -2), vencimientoMin: sumarMeses(hoy, 12) };
    }

    if (typeof module !== 'undefined') module.exports = { limitesFechasLote };
    else root.limitesFechasLote = limitesFechasLote;
})(typeof window !== 'undefined' ? window : globalThis);
