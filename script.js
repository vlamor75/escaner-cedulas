// Configuración
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSHSkIJWa2Ac2IhTjzcclUIWEWcdIzX8_2pEOLBQZ8QiIjiautmRYf-QWQpP9LnbAsricEF617yAv6V/pub?gid=0&single=true&output=csv';

// URL de tu Google Apps Script Web App
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzkb8Gr9djEGppAS6-rqgzHi-ctPseXoGpsROdmO3z4kUMpv7v0iV8YGrKiGAIkLu6Zjg/exec';

let datosSheet = [];
let stream = null;
let scanning = false;

// Cargar al iniciar
document.addEventListener('DOMContentLoaded', function() {
    console.log('App iniciada - Versión con Apps Script');
    
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
    mostrarResultado('📱 App lista para buscar y resaltar cédulas', 'encontrado');
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

// Cargar datos para verificación local (fallback)
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
        
        console.log('Datos de fallback cargados:', datosSheet.length, 'registros');
        
    } catch (error) {
        console.error('Error cargando datos de fallback:', error);
    }
}

// Función principal: buscar y resaltar usando Apps Script
async function buscarYResaltarEnSheet(cedula) {
    try {
        console.log('Enviando cédula a Apps Script:', cedula);
        mostrarResultado('🔄 Buscando y resaltando...', 'encontrado');
        
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cedula: cedula }),
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const resultado = await response.json();
        console.log('Respuesta de Apps Script:', resultado);
        
        if (resultado.success && resultado.encontrado) {
            // ¡Éxito! Persona encontrada y resaltada
            mostrarResultado(
                `✅ ENCONTRADO Y RESALTADO<br>
                <strong style="font-size: 20px; color: #2e7d32;">${resultado.datos.nombre}</strong><br>
                <strong>Cédula:</strong> ${resultado.datos.cedula}<br>
                <strong>Email:</strong> ${resultado.datos.email}<br>
                <div style="margin-top: 10px; padding: 8px; background: #e8f5e8; border-radius: 4px; font-size: 14px;">
                    🎨 Fila ${resultado.fila} resaltada en verde oliva en Google Sheets
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
                <small style="color: #666;">Cédula ${cedula} no está en la base de datos</small>`, 
                'no-encontrado'
            );
            
            // Vibración de error
            if (navigator.vibrate) {
                navigator.vibrate([500, 200, 500]);
            }
            
        } else {
            // Error en la respuesta
            throw new Error(resultado.message || 'Error desconocido en Apps Script');
        }
        
    } catch (error) {
        console.error('Error conectando con Apps Script:', error);
        
        mostrarResultado(
            `⚠️ Error de conexión<br>
            <small>Intentando búsqueda local...</small>`, 
            'no-encontrado'
        );
        
        // Fallback: buscar solo localmente
        setTimeout(() => {
            buscarCedulaLocal(cedula);
        }, 1500);
    }
}

// Búsqueda local como fallback (sin resaltado)
function buscarCedulaLocal(cedula) {
    console.log('Búsqueda local de fallback para:', cedula);
    
    const encontrado = datosSheet.find(persona => 
        persona.cedula === cedula || 
        persona.cedula === cedula.toString()
    );
    
    if (encontrado) {
        mostrarResultado(
            `✅ ENCONTRADO (solo verificación)<br>
            <strong style="font-size: 18px;">${encontrado.nombre}</strong><br>
            <strong>Cédula:</strong> ${encontrado.cedula}<br>
            <strong>Email:</strong> ${encontrado.email}<br>
            <div style="margin-top: 8px; padding: 6px; background: #fff3cd; border-radius: 4px; font-size: 13px; color: #856404;">
                ⚠️ No se pudo conectar con Google Sheets para resaltar
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
        
        // Mantener foco para siguiente búsqueda después de un momento
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

// Iniciar escáner de cámara con QuaggaJS
async function iniciarEscaner() {
    try {
        console.log('Iniciando escáner...');
        const video = document.getElementById('video');
        
        // Solicitar permisos de cámara
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment', // Cámara trasera
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });
        
        video.srcObject = stream;
        await video.play();
        
        // Actualizar botones
        document.getElementById('start-scan').style.display = 'none';
        document.getElementById('stop-scan').style.display = 'inline-block';
        
        scanning = true;
        mostrarResultado('📷 Cámara activa. Enfoca el código de barras de la cédula.', 'encontrado');
        
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
                        "code_39_reader",
                        "code_93_reader",
                        "i2of5_reader"
                    ]
                },
                locate: true,
                locator: {
                    halfSample: true,
                    patchSize: "medium"
                }
            }, function(err) {
                if (err) {
                    console.error('Error iniciando QuaggaJS:', err);
                    mostrarResultado('📷 Cámara activa. Use el campo manual para mejores resultados.', 'encontrado');
                    return;
                }
                
                console.log('QuaggaJS iniciado correctamente');
                Quagga.start();
            });
            
            // Configurar detección de códigos
            Quagga.onDetected(function(data) {
                if (scanning) {
                    const codigo = data.codeResult.code;
                    console.log('Código detectado:', codigo);
                    
                    // Verificar que el código parezca una cédula (solo números, longitud razonable)
                    if (/^\d{4,15}$/.test(codigo)) {
                        scanning = false; // Pausar para evitar múltiples detecciones
                        
                        mostrarResultado(`📱 Código detectado: ${codigo}`, 'encontrado');
                        
                        // Buscar el código
                        setTimeout(() => {
                            buscarYResaltarEnSheet(codigo);
                        }, 1000);
                        
                        // Reactivar scanning después de un momento
                        setTimeout(() => {
                            if (stream) { // Solo si el scanner sigue activo
                                scanning = true;
                            }
                        }, 5000);
                    } else {
                        console.log('Código detectado no parece cédula:', codigo);
                    }
                }
            });
            
        } else {
            console.log('QuaggaJS no disponible - solo cámara visual');
            mostrarResultado('📷 Cámara activa. QuaggaJS no disponible - usa el campo manual.', 'encontrado');
        }
        
    } catch (error) {
        console.error('Error accediendo a cámara:', error);
        mostrarResultado('❌ No se puede acceder a la cámara. Verifica permisos y usa el campo manual.', 'no-encontrado');
    }
}

// Detener escáner
function detenerEscaner() {
    console.log('Deteniendo escáner...');
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    if (typeof Quagga !== 'undefined') {
        Quagga.stop();
    }
    
    scanning = false;
    
    // Restaurar botones
    document.getElementById('start-scan').style.display = 'inline-block';
    document.getElementById('stop-scan').style.display = 'none';
    
    const video = document.getElementById('video');
    video.srcObject = null;
    
    mostrarResultado('📱 Escáner detenido. Usa el campo manual para buscar.', 'encontrado');
    
    // Auto-focus en el input
    setTimeout(() => {
        document.getElementById('manual-cedula').focus();
        document.getElementById('resultado').style.display = 'none';
    }, 2000);
}

// Mostrar resultado en la interfaz
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

// Función para compatibilidad con HTML
function guardarURL() {
    mostrarResultado('ℹ️ Configuración automática activa - Google Apps Script conectado', 'encontrado');
    setTimeout(() => {
        document.getElementById('resultado').style.display = 'none';
    }, 3000);
}

// Debug - mostrar información en consola
console.log('Script cargado correctamente');
console.log('Apps Script URL:', APPS_SCRIPT_URL);
console.log('CSV URL:', CSV_URL);
