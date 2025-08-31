// URL fija de tu Google Sheet CSV
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSHSkIJWa2Ac2IhTjzcclUIWEWcdIzX8_2pEOLBQZ8QiIjiautmRYf-QWQpP9LnbAsricEF617yAv6V/pub?gid=0&single=true&output=csv';

let datosSheet = [];
let stream = null;
let scanning = false;

// Cargar datos automáticamente al iniciar
document.addEventListener('DOMContentLoaded', function() {
    cargarDatos();
    // Ocultar configuración de URL ya que es fija
    const configDiv = document.querySelector('.config');
    if (configDiv) {
        configDiv.style.display = 'none';
    }
});

// Cargar datos del Google Sheet
async function cargarDatos() {
    try {
        mostrarResultado('🔄 Cargando datos...', 'encontrado');
        
        const response = await fetch(CSV_URL);
        const csvData = await response.text();
        
        // Parsear CSV línea por línea
        const lineas = csvData.split('\n');
        datosSheet = [];
        
        lineas.forEach((linea, index) => {
            if (linea.trim()) {
                const cols = linea.split(',');
                const cedula = cols[0]?.trim().replace(/"/g, '');
                const nombre = cols[1]?.trim().replace(/"/g, '');
                const email = cols[2]?.trim().replace(/"/g, '');
                
                if (cedula && cedula.length > 3) {
                    datosSheet.push({
                        fila: index + 1,
                        cedula: cedula,
                        nombre: nombre || 'Sin nombre',
                        email: email || 'Sin email'
                    });
                }
            }
        });
        
        console.log('Datos cargados:', datosSheet.length, 'registros');
        mostrarResultado(`✅ ${datosSheet.length} registros cargados y listos`, 'encontrado');
        
        // Auto ocultar después de 3 segundos
        setTimeout(() => {
            const resultado = document.getElementById('resultado');
            if (resultado && resultado.innerHTML.includes('registros cargados')) {
                resultado.style.display = 'none';
            }
        }, 3000);
        
    } catch (error) {
        console.error('Error cargando datos:', error);
        mostrarResultado('❌ Error cargando datos del Google Sheet', 'no-encontrado');
    }
}

// Iniciar cámara (solo visual)
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
        mostrarResultado('📷 Cámara activa. Escribe la cédula en el campo de abajo.', 'encontrado');
        
    } catch (error) {
        console.error('Error con cámara:', error);
        mostrarResultado('❌ No se puede usar la cámara. Usa el campo manual.', 'no-encontrado');
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
    
    // Limpiar resultado
    const resultado = document.getElementById('resultado');
    if (resultado && resultado.innerHTML.includes('Cámara activa')) {
        resultado.style.display = 'none';
    }
}

// Buscar cédula desde input manual
function buscarCedula() {
    const input = document.getElementById('manual-cedula');
    const cedula = input.value.trim();
    
    if (cedula) {
        buscarCedulaEnDatos(cedula);
        input.value = ''; // Limpiar campo
        input.focus(); // Mantener foco para siguiente búsqueda
    }
}

// Buscar en los datos cargados
function buscarCedulaEnDatos(cedula) {
    console.log('Buscando cédula:', cedula);
    
    if (!datosSheet.length) {
        mostrarResultado('❌ Los datos aún no están cargados. Espera un momento.', 'no-encontrado');
        return;
    }
    
    // Buscar coincidencia exacta
    const encontrado = datosSheet.find(persona => 
        persona.cedula === cedula || 
        persona.cedula === cedula.toString()
    );
    
    if (encontrado) {
        mostrarResultado(
            `✅ ENCONTRADO<br>
            <strong style="font-size: 18px;">${encontrado.nombre}</strong><br>
            <strong>Cédula:</strong> ${encontrado.cedula}<br>
            <strong>Email:</strong> ${encontrado.email}<br>
            <small style="color: #666;">Registro en fila ${encontrado.fila}</small>`, 
            'encontrado'
        );
        
        // Vibrar si está disponible
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]); // Patrón: vibrar-pausa-vibrar
        }
        
        // Auto ocultar después de 8 segundos
        setTimeout(() => {
            const resultado = document.getElementById('resultado');
            if (resultado && resultado.innerHTML.includes(encontrado.nombre)) {
                resultado.style.display = 'none';
            }
        }, 8000);
        
    } else {
        mostrarResultado(`❌ CÉDULA NO EXISTE<br><small>No se encontró: ${cedula}</small>`, 'no-encontrado');
        
        // Vibrar patrón de error
        if (navigator.vibrate) {
            navigator.vibrate([500]); // Vibración larga de error
        }
        
        // Auto ocultar después de 4 segundos
        setTimeout(() => {
            const resultado = document.getElementById('resultado');
            if (resultado && resultado.innerHTML.includes('NO EXISTE')) {
                resultado.style.display = 'none';
            }
        }, 4000);
    }
}

// Mostrar resultado en pantalla
function mostrarResultado(mensaje, tipo) {
    const resultado = document.getElementById('resultado');
    if (resultado) {
        resultado.innerHTML = mensaje;
        resultado.className = tipo;
        resultado.style.display = 'block';
        
        if (!mensaje) {
            resultado.style.display = 'none';
        }
    }
}

// Función para mantener compatibilidad con botón "Guardar URL" (aunque está oculto)
function guardarURL() {
    mostrarResultado('ℹ️ La URL ya está configurada automáticamente', 'encontrado');
    setTimeout(() => {
        document.getElementById('resultado').style.display = 'none';
    }, 2000);
}

// Eventos del input
document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('manual-cedula');
    
    // Buscar al presionar Enter
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            buscarCedula();
        }
    });
    
    // Evitar zoom en iOS
    input.addEventListener('focus', function() {
        this.style.fontSize = '16px';
    });
    
    // Permitir solo números
    input.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
    });
});

// Log para debug
console.log('App iniciada - Versión simple sin APIs de Google');
