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
        
        scanning = true;
        
        // Inicializar QuaggaJS para escaneo de códigos
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
                console.log('Error iniciando Quagga:', err);
                // Si falla el escáner, al menos mostrar el video
                mostrarResultado('Cámara iniciada. Escáner de códigos no disponible, usa input manual', 'no-encontrado');
                return;
            }
            Quagga.start();
        });
        
        // Escuchar detecciones
        Quagga.onDetected(function(data) {
            if (scanning) {
                const codigo = data.codeResult.code;
                console.log('Código detectado:', codigo);
                buscarCedulaEnDatos(codigo);
            }
        });
        
    } catch (error) {
        console.error('Error accediendo a la cámara:', error);
        mostrarResultado('No se puede acceder a la cámara. Usa el input manual.', 'no-encontrado');
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
    
    // Mostrar/ocultar botones
    document.getElementById('start-scan').style.display = 'inline-block';
    document.getElementById('stop-scan').style.display = 'none';
    
    const video = document.getElementById('video');
    video.srcObject = null;
}

// Buscar cédula (desde input manual)
function buscarCedula() {
    const cedula = document.getElementById('manual-cedula').value.trim();
    if (cedula) {
        buscarCedulaEnDatos(cedula);
        document.getElementById('manual-cedula').value = '';
    }
}

// Buscar cédula en los datos
function buscarCedulaEnDatos(cedula) {
    console.log('Buscando cédula:', cedula);
    
    if (!datosSheet.length) {
        mostrarResultado('Datos no cargados. Verifica la URL del Sheet.', 'no-encontrado');
        return;
    }
    
    const encontrado = datosSheet.find(persona => 
        persona.cedula === cedula || 
        persona.cedula === cedula.toString()
    );
    
    if (encontrado) {
        mostrarResultado(
            `✅ ENCONTRADO<br>
            <strong>${encontrado.nombre}</strong><br>
            Cédula: ${encontrado.cedula}<br>
            Email: ${encontrado.email}`, 
            'encontrado'
        );
        
        // Aquí podrías hacer una llamada para marcar/resaltar en el Sheet
        // Por ahora solo mostramos el resultado
        
    } else {
        mostrarResultado('❌ CÉDULA NO EXISTE', 'no-encontrado');
    }
}

// Mostrar resultado
function mostrarResultado(mensaje, tipo) {
    const resultado = document.getElementById('resultado');
    resultado.innerHTML = mensaje;
    resultado.className = tipo;
    resultado.style.display = 'block';
    
    // Ocultar después de 5 segundos si es exitoso
    if (tipo === 'encontrado') {
        setTimeout(() => {
            resultado.style.display = 'none';
        }, 5000);
    }
}

// Permitir buscar con Enter en el input
document.getElementById('manual-cedula').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        buscarCedula();
    }
});
