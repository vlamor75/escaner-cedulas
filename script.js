let stream = null;
let datosSheet = [];
let scanning = false;

// Cargar URL guardada al iniciar
document.addEventListener('DOMContentLoaded', function() {
    const savedUrl = localStorage.getItem('sheetUrl');
    if (savedUrl) {
        document.getElementById('sheet-url').value = savedUrl;
        cargarDatosSheet(savedUrl);
    }
});

// Guardar URL del Google Sheet
function guardarURL() {
    const url = document.getElementById('sheet-url').value;
    if (url) {
        localStorage.setItem('sheetUrl', url);
        cargarDatosSheet(url);
        mostrarResultado('URL guardada correctamente', 'encontrado');
    }
}

// Cargar datos del Google Sheet
async function cargarDatosSheet(url) {
    try {
        const response = await fetch(url);
        const csvData = await response.text();
        
        // Parsear CSV simple
        datosSheet = csvData.split('\n').map(row => {
            const cols = row.split(',');
            return {
                cedula: cols[0]?.trim().replace(/"/g, ''),
                nombre: cols[1]?.trim().replace(/"/g, ''),
                email: cols[2]?.trim().replace(/"/g, '')
            };
        }).filter(row => row.cedula); // Filtrar filas vacías
        
        console.log('Datos cargados:', datosSheet.length, 'registros');
    } catch (error) {
        console.error('Error cargando datos:', error);
        mostrarResultado('Error cargando datos del Sheet', 'no-encontrado');
    }
}

// Iniciar escáner
async function iniciarEscaner() {
    try {
        // Verificar si hay URL configurada
        const url = document.getElementById('sheet-url').value;
        if (!url) {
            mostrarResultado('Primero configura la URL del Google Sheet', 'no-encontrado');
            return;
        }
        
        if (!datosSheet.length) {
            await cargarDatosSheet(url);
        }

        const video = document.getElementById('video');
        
        // Solicitar acceso a la cámara
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment', // Cámara trasera
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });
        
        video.srcObject = stream;
        video.play();
        
        // Mostrar/ocultar botones
        document.getElementById('start-scan').style.display = 'none';
        document.getElementById('stop-scan').style.display = 'inline-block';
        
        scanning = true
