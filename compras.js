// Configuración de los datos requeridos para registrar una compra.
module.exports = {
    title: "Compras",
    description: "Registro de compras de medicamentos a laboratorios.",
    table: "compras",
    id: "id_compra",
    fields: [
        {
            name: "numero_factura",
            label: "Número de factura",
            autoInvoice: true,
            readOnly: true,    
            required: true
        },
        { 
            name: "id_usuario",
            label: "ID del usuario",
            type: "number",
            min: 1,
            currentUser: true,
            readOnly: true,
            required: true
        },
        {
            name: "id_distribuidor",
            label: "Laboratorio o proveedor",
            type: "distributor-name",
            displayName: "nombre_distribuidor",
            showInTable: true,
            required: true
        },
        {
            name: "telefono_distribuidor",
            label: "Teléfono del distribuidor",
            exactLength: 9,
            format: "phone",
            placeholder: "Ej. 9999-9999",
            virtual: true,
            required: true
        },
        {
            name: "correo_distribuidor",
            label: "Correo del distribuidor",
            type: "email",
            virtual: true,
            required: true
        },
        {
            name: "fecha_compra",
            label: "Fecha de compra",
            type: "date",
            defaultToday: true,
            maxToday: true,
            required: true
        },
        {
            name: "total",
            readOnly: true,
            label: "Total de la compra (Lps.)",
            placeholder: "L. 0.00",
            type: "number",
            min: 0,
            step: "0.01",
            required: true
        },
        {
            name: "metodo_pago",
            label: "Método de pago",
            type: "select",
            options: ["Efectivo", "Tarjeta", "Transferencia", "Credito"],
            required: true
        },
        {
            name: "estado",
            label: "Condición de la compra",
            type: "select",
            options: ["A Credito", "Cancelado"]
        },
    ]
};
