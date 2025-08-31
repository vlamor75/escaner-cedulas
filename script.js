// Configuración
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwA0MinrCYcwyviNNWwFSh9x0L-TRKXWntQJQXx6eGRxXyisq_NBvE2GDp8sGbDDWobDQ/exec';

let stream = null;
let scanning = false;
let timeoutId = null;
let tesseractWorker = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('App iniciada con OCR para cédulas colombianas');
    
    // Ocultar configuración
    const configDiv = document.querySelector('.config');
    if (configDiv) {
        configDiv.style.display = 'none';
    }
    
    setupEventListeners();
    loadTesseract();
    
    mostrarResultado('📱 Cargando escáner OCR para cédulas colombianas...', 'encontrado');
});

// Cargar Tesseract.js para OCR
async function loadTesseract() {
    try {
        // Cargar Tesseract desde CDN
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js';
        script.onload = async () => {
            console.log('Tesseract cargado, inicializando worker...');
            mostrarResultado('🔍 OCR listo - sistema preparado para escanear cédulas', 'encontrado');
            
            setTimeout(() => {
                document.getElementById('resultado').style.display = 'none';
            }, 3000);
        };
        document.head.appendChild(script);
    } catch (error) {
        console.error('Error cargando Tesseract:', error);
        mostrarResultado('⚠️ OCR no disponible - usa input manual', 'no-encontrado');
    }
}

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

function buscarYResaltarEnSheet(cedula) {
    console.log('Buscando cédula:', cedula);
    
    if (timeoutId) {
        clearTimeout(timeoutId);
    }
    
    mostrarResultado('🔄 Buscando y resaltando...', 'encontrado');
    
    const url = `${APPS_SCRIPT_URL}?cedula=${encodeURIComponent(cedula)}`;
    
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    
    document.body.appendChild(iframe);
    
    timeoutId = setTimeout(() => {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
        
        mostrarResultado(
            `✅ BÚSQUEDA COMPLETADA<br>
            <strong style="font-size: 18px;">Cédula: ${cedula}</strong><br>
            <div style="margin-top: 10px; padding: 8px; background: #e8f5e8; border-radius: 4px;">
                🎨 Si existe, se resaltó en Google Sheets<br>
                📋 Verifica tu hoja de cálculo
            </div>`, 
            'encontrado'
        );
        
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

// Capturar imagen y procesar con OCR
async function capturarYProcesarOCR() {
    if (!window.Tesseract) {
        mostrarResultado('❌ OCR no disponible - usa input manual', 'no-encontrado');
        return;
    }
    
    try {
        const video = document.getElementById('video');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Configurar canvas
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Capturar frame actual
        context.drawImage(video, 0, 0);
        
        // Convertir a imagen
        const imageData = canvas.toDataURL('image/png');
        
        mostrarResultado('🔍 Procesando imagen con OCR...', 'encontrado');
        
        // Procesar con Tesseract
        const result = await Tesseract.recognize(imageData, 'eng', {
            tessedit_char_whitelist: '0123456789.',
            psm: 6
        });
        
        const texto = result.data.text;
        console.log('Texto detectado:', texto);
        
        // Buscar números que parezcan cédulas (8-10 dígitos)
        const numeros = texto.match(/\b\d{8,10}\b/g);
        
        if (numeros && numeros.length > 0) {
            const cedula = numeros[0].replace(/\D/g, ''); // Solo números
            
            mostrarResultado(`📱 Cédula detectada: ${cedula}`, 'encontrado');
            
            setTimeout(() => {
                buscarYResaltarEnSheet(cedula);
            }, 1000);
            
        } else {
            mostrarResultado('❌ No se detectó número de cédula. Intenta de nuevo o usa input manual.', 'no-encontrado');
        }
        
    } catch (error) {
        console.error('Error en OCR:', error);
        mostrarResultado('❌ Error procesando imagen. Usa input manual.', 'no-encontrado');
    }
}

// Iniciar escáner de cámara con OCR
async function iniciarEscaner() {
    try {
        console.log('Iniciando escáner con OCR...');
        const video = document.getElementById('video');
        
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 }, // Mayor resolución para OCR
                height: { ideal: 720 }
            }
        });
        
        video.srcObject = stream;
        await video.play();
        
        document.getElementById('start-scan').style.display = 'none';
        document.getElementById('stop-scan').style.display = 'inline-block';
        
        // Agregar botón de captura
        const captureBtn = document.getElementById('capture-btn') || createCaptureButton();
        captureBtn.style.display = 'inline-block';
        
        scanning = true;
        mostrarResultado('📷 Cámara lista. Enfoca la cédula y presiona "Escanear Cédula" para procesarla.', 'encontrado');
        
    } catch (error) {
        console.error('Error con cámara:', error);
        mostrarResultado('❌ No se puede acceder a la cámara. Usa el campo manual.', 'no-encontrado');
    }
}

// Crear botón de captura si no existe
function createCaptureButton() {
    const button = document.createElement('button');
    button.id = 'capture-btn';
    button.innerHTML = '📸 Escanear Cédula';
    button.onclick = capturarYProcesarOCR;
    button.style.display = 'none';
    button.style.margin = '10px 5px';
    button.style.padding = '12px 20px';
    button.style.backgroundColor = '#28a745';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.fontSize = '16px';
    button.style.cursor = 'pointer';
    
    // Insertar después del botón de detener
    const buttonsDiv = document.querySelector('.buttons');
    buttonsDiv.appendChild(button);
    
    return button;
}

function detenerEscaner() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    scanning = false;
    
    document.getElementById('start-scan').style.display = 'inline-block';
    document.getElementById('stop-scan').style.display = 'none';
    
    const captureBtn = document.getElementById('capture-btn');
    if (captureBtn) {
        captureBtn.style.display = 'none';
    }
    
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
    mostrarResultado('ℹ️ Sistema con OCR para cédulas colombianas', 'encontrado');
    setTimeout(() => {
        document.getElementById('resultado').style.display = 'none';
    }, 2000);
}

console.log('App con OCR cargada');
