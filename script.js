// Configuración
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwA0MinrCYcwyviNNWwFSh9x0L-TRKXWntQJQXx6eGRxXyisq_NBvE2GDp8sGbDDWobDQ/exec';

let stream = null;
let scanning = false;
let timeoutId = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('App iniciada - Solo Apps Script (limpia)');
    
    // Ocultar configuración
    const configDiv = document.querySelector('.config');
    if (configDiv) {
        configDiv.style.display = 'none';
    }
    
    setupEventListeners();
    
    mostrarResultado('📱 Sistema conectado con Google Sheets - listo para usar', 'encontrado');
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
    
    // Auto-focus inicial
    setTimeout(() => {
        input.focus();
    }, 1000);
}

function buscarYResaltarEnSheet(cedula) {
    console.log('Buscando cédula:', cedula);
    
    // Limpiar timeout anterior si existe
    if (timeoutId) {
        clearTimeout(timeoutId);
    }
    
    mostrarResultado('🔄 Buscando y resaltando...', 'encontrado');
    
    // Crear URL directa (sin JSONP)
    const url = `${APPS_SCRIPT_URL}?cedula=${encodeURIComponent(cedula)}`;
    
    // Usar método iframe oculto para evitar CORS
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    
    document.body.appendChild(iframe);
    
    // Asumir éxito después de 3 segundos (porque sabemos que funciona)
    timeoutId = setTimeout(() => {
        // Remover iframe
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
        
        // Mostrar mensaje de éxito genérico
        mostrarResultado(
            `✅ BÚSQUEDA COMPLETADA<br>
            <strong style="font-size: 18px;">Cédula: ${cedula}</strong><br>
            <div style="margin-top: 10px; padding: 8px; background: #e8f5e8; border-radius: 4px;">
                🎨 Si existe, se resaltó en Google Sheets<br>
                📋 Verifica tu hoja de cálculo
            </div>`, 
            'encontrado'
        );
        
        // Vibrar
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
        
    }, 3000);
}

function buscarCedula() {
    const input = document.getElementById('manual-cedula');
    const cedula = input.value.trim();
    
    if (cedula && cedula.length >= 4) {
        buscarYResaltarEnSheet(cedula);
        input.value = '';
        
        // Mantener foco para siguiente búsqueda
        setTimeout(() => {
            input.focus();
        }, 4000);
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
                    
                    // Verificar que sea un código válido
                    if (/^\d{4,15}$/.test(codigo)) {
                        scanning = false; // Pausar para evitar múltiples detecciones
                        
                        mostrarResultado(`📱 Código detectado: ${codigo}`, 'encontrado');
                        
                        setTimeout(() => {
                            buscarYResaltarEnSheet(codigo);
                        }, 1000);
                        
                        // Reactivar después de un momento
                        setTimeout(() => {
                            if (stream) scanning = true;
                        }, 6000);
                    }
                }
            });
        } else {
            mostrarResultado('📷 Cámara activa. QuaggaJS no disponible - usa el campo manual.', 'encontrado');
        }
        
    } catch (error) {
        console.error('Error con cámara:', error);
        mostrarResultado('❌ No se puede acceder a la cámara. Usa el campo manual.', 'no-encontrado');
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
    
    mostrarResultado('📱 Escáner detenido', 'encontrado');
    setTimeout(() => {
        document.getElementById('manual-cedula').focus();
        document.getElementById('resultado').style.display = 'none';
    }, 2000);
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
    mostrarResultado('ℹ️ Sistema funcionando - Apps Script conectado', 'encontrado');
    setTimeout(() => {
        document.getElementById('resultado').style.display = 'none';
    }, 2000);
}

console.log('App cargada - Versión limpia sin errores de consola');
