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

// Iniciar escáner simplificado
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
        mostrarResultado('📷 Cámara activa. Usa el campo manual para buscar cédulas.', 'encontrado');
        
        // Intentar escáner automático cada 2 segundos
        const scanInterval = setInterval(() => {
            if (!scanning) {
                clearInterval(scanInterval);
                return;
            }
            
            // Aquí podrías agregar lógica de OCR o procesamiento de imagen
            // Por ahora, simplemente recordamos al usuario usar el input manual
            
        }, 2000);
        
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
    
    scanning = false;
    
    // Mostrar/ocultar botones
    document.getElementById('start-scan').style.display = 'inline-block';
    document.getElementById('stop-scan').style.display = 'none';
    
    const video = document.getElementById('video');
    video.srcObject = null;
    
    mostrarResultado('', '');
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
        
        // Vibrar si está disponible
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
        
    } else {
        mostrarResultado('❌ CÉDULA NO EXISTE', 'no-encontrado');
        
        // Vibración de error
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
    
    // Ocultar después de 5 segundos si es exitoso
    if (tipo === 'encontrado') {
        setTimeout(() => {
            if (resultado.innerHTML === mensaje) { // Solo ocultar si es el mismo mensaje
                resultado.style.display = 'none';
            }
        }, 5000);
    }
}

// Permitir buscar con Enter en el input
document.getElementById('manual-cedula').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        buscarCedula();
    }
});

// Hacer el input más grande en móviles
document.getElementById('manual-cedula').addEventListener('focus', function() {
    this.style.fontSize = '16px'; // Previene zoom en iOS
});
