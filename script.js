// Configuración
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSHSkIJWa2Ac2IhTjzcclUIWEWcdIzX8_2pEOLBQZ8QiIjiautmRYf-QWQpP9LnbAsricEF617yAv6V/pub?gid=0&single=true&output=csv';

// URL de tu Google Apps Script Web App - usando GET con parámetros para evitar CORS
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxAznJoo2V0TvMnPyL8glN4sPDH8ZkVS4aDaDGjEeMqb7HziS-W0R1GidkSRgGuf4hBMQ/exec';

let datosSheet = [];
let stream = null;
let scanning = false;

// Cargar al iniciar
document.addEventListener('DOMContentLoaded', function() {
    console.log('App iniciada - Versión JSONP sin CORS');
    
    // Ocultar configuración
    const configDiv = document.querySelector('.config');
    if (configDiv) {
        configDiv.style.display = 'none';
    }
    
    // Cargar datos para verificación local
    cargarDatos();
    
    // Configurar eventos
    setupEventListeners();
    
    // Mostrar estado inicial
    mostrarResultado('📱 App lista - busca cédulas y resalta automáticamente', 'encontrado');
    setTimeout(() => {
        document.getElementById('resultado').style.display = 'none';
    }, 4000);
});

// Configurar eventos del input
function setupEventListeners() {
    const input = document.getElementById('manual-cedula');
    
    // Buscar con Enter
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            buscarCedula();
        }
    });
    
    // Evitar zoom en iOS
    input.addEventListener('focus', function() {
        this.style.fontSize = '16px';
    });
    
    // Solo permitir números
    input.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
    });
    
    // Auto-focus para facilitar uso
    setTimeout(() => {
        input.focus();
    }, 1000);
}

// Cargar datos para verificación local
async function cargarDatos() {
    try {
        const response = await fetch(CSV_URL);
        const csvData = await response.text();
        
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
        
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

// Función usando GET con parámetros (evita CORS)
function buscarYResaltarEnSheet(cedula) {
    console.log('Buscando con método GET:', cedula);
    mostrarResultado('🔄 Conectando con Google Sheets...', 'encontrado');
    
    // Crear URL con parámetros
    const url = `${APPS_SCRIPT_URL}?cedula=${encodeURIComponent(cedula)}&callback=manejarRespuestaAppsScript&_=${Date.now()}`;
    
    // Crear script tag para JSONP
    const script = document.createElement('script');
    script.src = url;
    
    // Limpiar script después de uso
    script.onload = () => {
        document.head.removeChild(script);
    };
    
    script.onerror = () => {
        console.error('Error cargando script de Apps Script');
        document.head.removeChild(script);
        
        // Fallback a búsqueda local
        mostrarResultado('⚠️ Error de conexión, buscando localmente...', 'no-encontrado');
        setTimeout(() => {
            buscarCedulaLocal(cedula);
        }, 1000);
    };
    
    // Timeout de seguridad
    setTimeout(() => {
        if (document.head.contains(script)) {
            console.log('Timeout - fallback a búsqueda local');
            document.head.removeChild(script);
            mostrarResultado('⏰ Conexión lenta, buscando localmente...', 'no-encontrado');
            setTimeout(() => {
                buscarCedulaLocal(cedula);
            }, 1000);
        }
    }, 8000);
    
    document.head.appendChild(script);
}

// Callback para manejar respuesta de Apps Script
window.manejarRespuestaAppsScript = function(resultado) {
    console.log('Respuesta recibida de Apps Script:', resultado);
    
    if (resultado.success && resultado.encontrado) {
        // ¡Éxito! Persona encontrada y resaltada
        mostrarResultado(
            `✅ ENCONTRADO Y RESALTADO<br>
            <strong style="font-size: 20px; color: #2e7d32;">${resultado.datos.nombre}</strong><br>
            <strong>Cédula:</strong> ${resultado.datos.cedula}<br>
            <strong>Email:</strong> ${resultado.datos.email}<br>
            <div style="margin-top: 10px; padding: 8px; background: #e8f5e8; border-radius: 4px; font-size: 14px;">
                🎨 Fila ${resultado.fila} resaltada en verde oliva en Google Sheets ✓
            </div>`, 
            'encontrado'
        );
        
        // Vibración de éxito
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
        }
        
    } else if (resultado.success && !resultado.encontrado) {
        // No encontrado
        mostrarResultado(
            `❌ CÉDULA NO EXISTE<br>
            <small style="color: #666;">${resultado.message}</small>`, 
            'no-encontrado'
        );
        
        // Vibración de error
        if (navigator.vibrate) {
            navigator.vibrate([500, 200, 500]);
        }
        
    } else {
        // Error
        console.error('Error en Apps Script:', resultado);
        mostrarResultado('⚠️ Error en Google Sheets, buscando localmente...', 'no-encontrado');
        
        // Fallback a búsqueda local
        const cedula = document.getElementById('manual-cedula').value || 'desconocida';
        setTimeout(() => {
            buscarCedulaLocal(cedula);
        }, 1000);
    }
};

// Búsqueda local como fallback
function buscarCedulaLocal(cedula) {
    console.log('Búsqueda local para:', cedula);
    
    const encontrado = datosSheet.find(persona => 
        persona.cedula === cedula || 
        persona.cedula === cedula.toString()
    );
    
    if (encontrado) {
        mostrarResultado(
            `✅ ENCONTRADO (verificación local)<br>
            <strong style="font-size: 18px;">${encontrado.nombre}</strong><br>
            <strong>Cédula:</strong> ${encontrado.cedula}<br>
            <strong>Email:</strong> ${encontrado.email}<br>
            <div style="margin-top: 8px; padding: 6px; background: #fff3cd; border-radius: 4px; font-size: 13px; color: #856404;">
                ⚠️ Sin conexión a Google Sheets - no se pudo resaltar
            </div>`, 
            'encontrado'
        );
        
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
    } else {
        mostrarResultado('❌ CÉDULA NO EXISTE', 'no-encontrado');
        
        if (navigator.vibrate) {
            navigator.vibrate([500]);
        }
    }
}

// Buscar cédula desde input manual
function buscarCedula() {
    const input = document.getElementById('manual-cedula');
    const cedula = input.value.trim();
    
    if (cedula && cedula.length >= 4) {
        buscarYResaltarEnSheet(cedula);
        input.value = '';
        
        // Mantener foco para siguiente búsqueda
        setTimeout(() => {
            input.focus();
        }, 3000);
    } else {
        mostrarResultado('⚠️ Ingresa una cédula válida (mínimo 4 dígitos)', 'no-encontrado');
        setTimeout(() => {
            document.getElementById('resultado').style.display = 'none';
        }, 2000);
    }
}

// Iniciar escáner de cámara
async function iniciarEscaner() {
    try {
        console.log('Iniciando escáner...');
        const video = document.getElementById('video');
        
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });
        
        video.srcObject = stream;
        await video.play();
        
        document.getElementById('start-scan').style.display = 'none';
        document.getElementById('stop-scan').style.display = 'inline-block';
        
        scanning = true;
        mostrarResultado('📷 Cámara activa. Enfoca el código de barras o usa el campo manual.', 'encontrado');
        
        // Inicializar QuaggaJS si está disponible
        if (typeof Quagga !== 'undefined') {
            console.log('Inicializando QuaggaJS...');
            
            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: video,
                    constraints: {
                        width: 640,
                        height: 480,
                        facingMode: "environment"
                    }
                },
                decoder: {
                    readers: [
                        "code_128_reader",
                        "ean_reader",
                        "ean_8_reader", 
                        "code_39_reader"
                    ]
                }
            }, function(err) {
                if (err) {
                    console.error('Error QuaggaJS:', err);
                    return;
                }
                Quagga.start();
            });
            
            Quagga.onDetected(function(data) {
                if (scanning) {
                    const codigo = data.codeResult.code;
                    console.log('Código detectado:', codigo);
                    
                    if (/^\d{4,15}$/.test(codigo)) {
                        scanning = false;
                        mostrarResultado(`📱 Código detectado: ${codigo}`, 'encontrado');
                        
                        setTimeout(() => {
                            buscarYResaltarEnSheet(codigo);
                        }, 1000);
                        
                        setTimeout(() => {
                            if (stream) scanning = true;
                        }, 5000);
                    }
                }
            });
        }
        
    } catch (error) {
        console.error('Error con cámara:', error);
        mostrarResultado('❌ No se puede acceder a la cámara. Usa el campo manual.', 'no-encontrado');
    }
}

// Detener escáner
function detenerEscaner() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    if (typeof Quagga !== 'undefined') {
        Quagga.stop();
    }
    
    scanning = false;
    
    document.getElementById('start-scan').style.display = 'inline-block';
    document.getElementById('stop-scan').style.display = 'none';
    
    const video = document.getElementById('video');
    video.srcObject = null;
    
    mostrarResultado('📱 Escáner detenido', 'encontrado');
    setTimeout(() => {
        document.getElementById('manual-cedula').focus();
        document.getElementById('resultado').style.display = 'none';
    }, 2000);
}

// Mostrar resultado
function mostrarResultado(mensaje, tipo) {
    const resultado = document.getElementById('resultado');
    if (resultado) {
        resultado.innerHTML = mensaje;
        resultado.className = tipo;
        resultado.style.display = 'block';
    }
}

// Función para compatibilidad
function guardarURL() {
    mostrarResultado('ℹ️ Sistema conectado con Google Apps Script', 'encontrado');
    setTimeout(() => {
        document.getElementById('resultado').style.display = 'none';
    }, 3000);
}

console.log('App cargada - Método JSONP para evitar CORS');
