// Configuración
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSHSkIJWa2Ac2IhTjzcclUIWEWcdIzX8_2pEOLBQZ8QiIjiautmRYf-QWQpP9LnbAsricEF617yAv6V/pub?gid=0&single=true&output=csv';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwA0MinrCYcwyviNNWwFSh9x0L-TRKXWntQJQXx6eGRxXyisq_NBvE2GDp8sGbDDWobDQ/exec';

let datosSheet = [];
let stream = null;
let scanning = false;
let respuestaRecibida = false;

document.addEventListener('DOMContentLoaded', function() {
    console.log('App iniciada - Sistema híbrido optimizado');
    
    const configDiv = document.querySelector('.config');
    if (configDiv) {
        configDiv.style.display = 'none';
    }
    
    cargarDatos();
    setupEventListeners();
    
    mostrarResultado('📱 Sistema listo - busca y resalta automáticamente', 'encontrado');
    setTimeout(() => {
        document.getElementById('resultado').style.display = 'none';
    }, 3000);
});

function setupEventListeners() {
    const input = document.getElementById('manual-cedula');
    
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            buscarCedula();
        }
    });
    
    input.addEventListener('focus', function() {
        this.style.fontSize = '16px';
    });
    
    input.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
    });
    
    setTimeout(() => {
        input.focus();
    }, 1000);
}

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

function buscarYResaltarEnSheet(cedula) {
    console.log('Buscando:', cedula);
    respuestaRecibida = false;
    
    mostrarResultado('🔄 Buscando y resaltando en Google Sheets...', 'encontrado');
    
    const url = `${APPS_SCRIPT_URL}?cedula=${encodeURIComponent(cedula)}&callback=manejarRespuestaAppsScript&_=${Date.now()}`;
    
    const script = document.createElement('script');
    script.src = url;
    
    script.onload = () => {
        if (document.head.contains(script)) {
            document.head.removeChild(script);
        }
    };
    
    script.onerror = () => {
        console.error('Error de red con Apps Script');
        if (document.head.contains(script)) {
            document.head.removeChild(script);
        }
        
        // Solo hacer fallback si no recibimos respuesta
        if (!respuestaRecibida) {
            setTimeout(() => {
                if (!respuestaRecibida) {
                    console.log('Sin respuesta de Apps Script, usando fallback');
                    mostrarResultado('⚠️ Sin conexión, verificando localmente...', 'no-encontrado');
                    setTimeout(() => {
                        buscarCedulaLocal(cedula);
                    }, 1000);
                }
            }, 1000);
        }
    };
    
    // Timeout más largo para dar tiempo
    setTimeout(() => {
        if (document.head.contains(script)) {
            document.head.removeChild(script);
        }
        
        if (!respuestaRecibida) {
            console.log('Timeout, usando fallback local');
            mostrarResultado('⏰ Respuesta lenta, verificando localmente...', 'no-encontrado');
            setTimeout(() => {
                buscarCedulaLocal(cedula);
            }, 1000);
        }
    }, 10000); // 10 segundos
    
    document.head.appendChild(script);
}

window.manejarRespuestaAppsScript = function(resultado) {
    respuestaRecibida = true;
    console.log('Respuesta de Apps Script:', resultado);
    
    if (resultado.success && resultado.encontrado) {
        mostrarResultado(
            `✅ ENCONTRADO Y RESALTADO<br>
            <strong style="font-size: 20px; color: #2e7d32;">${resultado.datos.nombre}</strong><br>
            <strong>Cédula:</strong> ${resultado.datos.cedula}<br>
            <strong>Email:</strong> ${resultado.datos.email}<br>
            <div style="margin-top: 10px; padding: 8px; background: #e8f5e8; border-radius: 4px;">
                🎨 Fila ${resultado.fila} resaltada en verde oliva ✅
            </div>`, 
            'encontrado'
        );
        
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
        }
        
    } else if (resultado.success && !resultado.encontrado) {
        mostrarResultado(
            `❌ CÉDULA NO EXISTE<br>
            <small>${resultado.message}</small>`, 
            'no-encontrado'
        );
        
        if (navigator.vibrate) {
            navigator.vibrate([500, 200, 500]);
        }
        
    } else {
        console.error('Error en respuesta:', resultado);
        mostrarResultado('❌ Error en Google Sheets', 'no-encontrado');
    }
};

function buscarCedulaLocal(cedula) {
    console.log('Búsqueda local:', cedula);
    
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
            <div style="margin-top: 8px; padding: 6px; background: #fff3cd; border-radius: 4px; font-size: 13px;">
                ⚠️ Google Sheets no disponible - sin resaltado
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

function buscarCedula() {
    const input = document.getElementById('manual-cedula');
    const cedula = input.value.trim();
    
    if (cedula && cedula.length >= 4) {
        buscarYResaltarEnSheet(cedula);
        input.value = '';
        setTimeout(() => input.focus(), 3000);
    } else {
        mostrarResultado('⚠️ Ingresa una cédula válida', 'no-encontrado');
        setTimeout(() => document.getElementById('resultado').style.display = 'none', 2000);
    }
}

async function iniciarEscaner() {
    try {
        const video = document.getElementById('video');
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        
        video.srcObject = stream;
        await video.play();
        
        document.getElementById('start-scan').style.display = 'none';
        document.getElementById('stop-scan').style.display = 'inline-block';
        
        scanning = true;
        mostrarResultado('📷 Cámara activa. Enfoca código de barras.', 'encontrado');
        
        if (typeof Quagga !== 'undefined') {
            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream", 
                    target: video
                },
                decoder: {
                    readers: ["code_128_reader", "ean_reader", "code_39_reader"]
                }
            }, function(err) {
                if (err) return;
                Quagga.start();
            });
            
            Quagga.onDetected(function(data) {
                if (scanning) {
                    const codigo = data.codeResult.code;
                    if (/^\d{4,15}$/.test(codigo)) {
                        scanning = false;
                        mostrarResultado(`📱 Código: ${codigo}`, 'encontrado');
                        
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
        mostrarResultado('❌ Error con cámara. Usa el campo manual.', 'no-encontrado');
    }
}

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
    
    setTimeout(() => {
        document.getElementById('manual-cedula').focus();
    }, 1000);
}

function mostrarResultado(mensaje, tipo) {
    const resultado = document.getElementById('resultado');
    if (resultado) {
        resultado.innerHTML = mensaje;
        resultado.className = tipo;
        resultado.style.display = 'block';
    }
}

function guardarURL() {
    mostrarResultado('ℹ️ Sistema configurado automáticamente', 'encontrado');
    setTimeout(() => document.getElementById('resultado').style.display = 'none', 2000);
}
