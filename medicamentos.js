const tabla =
document.getElementById(
"tablaMedicamentos"
);



async function cargarMedicamentos(){


const respuesta =
await window.farmacia.listarMedicamentos();



tabla.innerHTML="";



respuesta.datos.forEach(m=>{


tabla.innerHTML += `

<tr>

<td>${m.nombre}</td>

<td>${m.categoria}</td>

<td>L. ${m.precio_venta ?? 0}</td>

<td>${m.stock_total}</td>


<td>

<button onclick="editar(${m.id_medicamento})">

Editar

</button>


<button onclick="mostrarLotes(${m.id_medicamento})">

Lotes

</button>


</td>


</tr>


`;

});


}



function editar(id){


document
.getElementById("editarMedicamento")
.hidden=false;



document
.getElementById("id_medicamento")
.value=id;


}



document
.getElementById("formEditar")
.addEventListener(
"submit",

async(e)=>{


e.preventDefault();



await window.farmacia.actualizarMedicamento({

id:
document.getElementById("id_medicamento").value,

nombre:
document.getElementById("nombre").value,

categoria:
document.getElementById("categoria").value,

restriccion:
document.getElementById("restriccion").value


});



document.getElementById(
"editarMedicamento"
).hidden=true;


cargarMedicamentos();


});




document
.getElementById("cancelar")
.onclick=()=>{

document
.getElementById("editarMedicamento")
.hidden=true;

}




async function mostrarLotes(id){


const respuesta=
await window.farmacia.verLotesMedicamento(id);



const tabla=
document.getElementById("tablaLotes");


tabla.innerHTML="";


respuesta.datos.forEach(l=>{


tabla.innerHTML+=`

<tr>

<td>${l.numero_lote}</td>

<td>${l.fecha_vencimiento}</td>

<td>${l.cantidad_disponible}</td>

<td>L.${l.precio_venta}</td>


</tr>

`;

});


document
.getElementById("detalleLotes")
.hidden=false;


}



cargarMedicamentos();