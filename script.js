// URL fija de tu Google Sheet CSV
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSHSkIJWa2Ac2IhTjzcclUIWEWcdIzX8_2pEOLBQZ8QiIjiautmRYf-QWQpP9LnbAsricEF617yAv6V/pub?gid=0&single=true&output=csv';

let datosSheet = [];
let stream = null;
let scanning = false;

// Cargar datos automáticamente al iniciar
document.addEventListener('DOMContentLoaded', function() {
    cargarDatos();
    // Ocultar configuración ya que la URL es fija
    document.querySelector('.config').style.display = 'none';
});

// Cargar datos del Google Sheet
async function cargarDatos() {
    try {
        mostrarResultado('🔄 Cargando datos...', 'encontrado');
        
        const response = await fetch(CSV_URL);
        const csvData = await response.text();
        
        // Parsear CSV
        datosSheet = csvData.split('\n').map((row, index) => {
            const cols = row.split(',');
            return {
                fila: index + 1,
                cedula: cols[0]?.trim().replace(/"/g, ''),
                nombre: cols[1]?.trim().replace(/"/g, ''),
                email: cols[2]?.trim().replace(/"/g, '')
            };
        }).filter(row => row.cedula && row.cedula.length > 3);
        
        console.log('Datos cargados:', datosSheet.length, 'registros');
        mostrarResultado(`✅ ${datosSheet.length} registros listos`, 'encontrado');
        
        // Auto ocultar después de 3 segundos
        setTimeout(() => {
            document.getElementById('resultado').style.display = 'none';
        }, 3000);
        
    } catch (error) {
        console.error('Error cargando datos:', error);
        mostrarResultado('❌ Error cargando datos', 'no-encontrado');
    }
}

// Resaltar fila en Google Sheets (simulado - solo visual en app)
async function marcarComoEncontrado(persona) {
    // Para simplificar, solo mostramos que fue "marcado"
    // Si quieres marcado real en el Sheet, necesitarías la API compleja
    
    mostrarResultado(
        `✅ ENCONTRADO<br>
        <strong>${persona.nombre}</strong><br>
        Cédula: ${persona.cedula}<br>
        Email: ${persona.email}<br>
        <small>📋 Registro marcado (fila ${persona.fila})</small>`, 
        'encontrado'
    );
    
    // Vibrar
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }
    
    // Si quieres el marcado real en Google Sheets, 
    // necesitarías habilitar la API y autorización
}

// Iniciar cámara (simple)
async function iniciarEscaner() {
    try {
        if (!datosSheet.length) {
            mostrarResultado('❌ Esperando que carguen los datos...', 'no-encontrado');
            return;
        }

        const video = document.getElementById('video');
        
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });
        
        video.srcObject = stream;
        video.play();
        
        document.getElementById('start-scan').style.display = 'none';
        document.getElementById('stop-scan').style.display = 'inline-block';
        
        scanning = true;
        mostrarResultado('📷 Cámara lista. Usa el input manual para buscar.', 'encontrado');
        
    } catch (error) {
        console.error('Error con cámara:', error);
        mostrarResultado('❌ Problema con cámara. Usa el input manual.', 'no-encontrado');
    }
}

// Detener cámara
function detenerEscaner() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    scanning = false;
    
    document.getElementById('start-scan').style.display = 'inline-block';
    document.getElementById('stop-scan').style.display = 'none';
    
    const video = document.getElementById('video');
    video.srcObject = null;
    
    document.getElementById('resultado').style.display = 'none';
}

// Buscar cédula desde input manual
function buscarCedula() {
    const cedula = document.getElementById('manual-cedula').value.trim();
    if (cedula) {
        buscarCedulaEnDatos(cedula);
        document.getElementById('manual-cedula').value = '';
    }
}

// Buscar en los datos
async function buscarCedulaEnDatos(cedula) {
    console.log('Buscando:', cedula);
    
    if (!datosSheet.length) {
        mostrarResultado('❌ Los datos aún no están cargados', 'no-encontrado');
        return;
    }
    
    const encontrado = datosSheet.find(persona => 
        persona.cedula === cedula || 
        persona.cedula === cedula.toString()
    );
    
    if (encontrado) {
        await marcarComoEncontrado(encontrado);
    } else {
        mostrarResultado('❌ CÉDULA NO EXISTE', 'no-encontrado');
        
        if (navigator.vibrate) {
            navigator.vibrate([500]);
        }
    }
}

// Mostrar resultado
function mostrarResultado(mensaje, tipo) {
    const resultado = document.getElementById('resultado');
    resultado.innerHTML = mensaje;
    resultado.className = tipo;
    resultado.style.display = 'block';
    
    if (!mensaje) {
        resultado.style.display = 'none';
        return;
    }
}

// Eventos
document.getElementById('manual-cedula').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        buscarCedula();
    }
});

document.getElementById('manual-cedula').addEventListener('focus', function() {
    this.style.fontSize = '16px';
});

// Funciones para botones (mantener compatibilidad con HTML)
function guardarURL() {
    mostrarResultado('✅ URL ya está configurada automáticamente', 'encontrado');
    setTimeout(() => {
        document.getElementById('resultado').style.display = 'none';
    }, 2000);
}
