// Configuración de Google Sheets API
const CLIENT_ID = '126302235387-6akve29ev699n4qu7mmc4vhp3n0phdtb.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDc2QXU57bYL-wKcB0yWMqZObZbNhs1Fn4';
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let stream = null;
let datosSheet = [];
let scanning = false;
let gapi;
let isSignedIn = false;
let currentSpreadsheetId = '183ahrrdVdI8nT8dQfR-k1xI0ReqCtaVNZCg3LjP2oSw';

// Cargar Google API
function loadGoogleAPI() {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = initializeGapi;
    document.head.appendChild(script);
}

// Inicializar Google API
async function initializeGapi() {
    await new Promise((resolve) => {
        gapi.load('auth2:client', resolve);
    });
    
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            clientId: CLIENT_ID,
            discoveryDocs: [DISCOVERY_DOC],
            scope: SCOPES
        });
        
        const authInstance = gapi.auth2.getAuthInstance();
        isSignedIn = authInstance.isSignedIn.get();
        
        if (isSignedIn) {
            mostrarResultado('✅ Conectado a Google Sheets', 'encontrado');
        }
    } catch (error) {
        console.error('Error inicializando Google API:', error);
    }
}

// Cargar URL guardada al iniciar
document.addEventListener('DOMContentLoaded', function() {
    loadGoogleAPI();
    
    // URL por defecto del CSV
    const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSHSkIJWa2Ac2IhTjzcclUIWEWcdIzX8_2pEOLBQZ8QiIjiautmRYf-QWQpP9LnbAsricEF617yAv6V/pub?gid=0&single=true&output=csv';
    
    const savedUrl = localStorage.getItem('sheetUrl') || csvUrl;
    document.getElementById('sheet-url').value = savedUrl;
    cargarDatosSheet(savedUrl);
});

// Autorizar con Google
async function authorize() {
    try {
        const authInstance = gapi.auth2.getAuthInstance();
        if (!authInstance.isSignedIn.get()) {
            await authInstance.signIn();
        }
        isSignedIn = true;
        mostrarResultado('✅ Autorizado con Google', 'encontrado');
        return true;
    } catch (error) {
        console.error('Error de autorización:', error);
        mostrarResultado('❌ Error de autorización con Google', 'no-encontrado');
        return false;
    }
}

// Guardar URL del Google Sheet
function guardarURL() {
    const url = document.getElementById('sheet-url').value;
    if (url) {
        localStorage.setItem('sheetUrl', url);
        cargarDatosSheet(url);
        mostrarResultado('✅ URL guardada correctamente', 'encontrado');
    }
}

// Cargar datos del Google Sheet
async function cargarDatosSheet(url) {
    try {
        const response = await fetch(url);
        const csvData = await response.text();
        
        // Parsear CSV simple
        datosSheet = csvData.split('\n').map((row, index) => {
            const cols = row.split(',');
            return {
                fila: index + 1, // Número de fila para resaltar (empieza en 1)
                cedula: cols[0]?.trim().replace(/"/g, ''),
                nombre: cols[1]?.trim().replace(/"/g, ''),
                email: cols[2]?.trim().replace(/"/g, '')
            };
        }).filter(row => row.cedula && row.cedula.length > 3); // Filtrar filas vacías o inválidas
        
        console.log('Datos cargados:', datosSheet.length, 'registros');
        mostrarResultado(`📊 ${datosSheet.length} registros cargados`, 'encontrado');
    } catch (error) {
        console.error('Error cargando datos:', error);
        mostrarResultado('❌ Error cargando datos del Sheet', 'no-encontrado');
    }
}

// Resaltar fila en Google Sheets con verde oliva
async function resaltarFila(numeroFila) {
    if (!isSignedIn) {
        const authorized = await authorize();
        if (!authorized) return false;
    }
    
    try {
        const requests = [{
            updateCells: {
                range: {
                    sheetId: 0, // Primera hoja
                    startRowIndex: numeroFila - 1, // API usa índice 0
                    endRowIndex: numeroFila,
                    startColumnIndex: 0,
                    endColumnIndex: 10 // Resaltar hasta columna J
                },
                rows: [{
                    values: Array(10).fill({
                        userEnteredFormat: {
                            backgroundColor: {
                                red: 0.5,   // Verde oliva
                                green: 0.7, // Verde oliva  
                                blue: 0.2,  // Verde oliva
                                alpha: 1.0
                            }
                        }
                    })
                }],
                fields: 'userEnteredFormat.backgroundColor'
            }
        }];
        
        const response = await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: currentSpreadsheetId,
            requestBody: { requests }
        });
        
        console.log('Fila resaltada:', response);
        return true;
        
    } catch (error) {
        console.error('Error resaltando fila:', error);
        
        // Si no está autorizado, intentar autorizar
        if (error.status === 401) {
            const authorized = await authorize();
            if (authorized) {
                return await resaltarFila(numeroFila); // Reintentar
            }
        }
        
        mostrarResultado('❌ Error resaltando en Google Sheets. ¿Necesitas autorizar?', 'no-encontrado');
        return false;
    }
}

// Iniciar escáner simplificado
async function iniciarEscaner() {
    try {
        const url = document.getElementById('sheet-url').value;
        if (!url) {
            mostrarResultado('❌ Primero configura la URL del Google Sheet', 'no-encontrado');
            return;
        }
        
        if (!datosSheet.length) {
            await cargarDatosSheet(url);
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
        mostrarResultado('📷 Cámara activa. Usa el campo manual para buscar cédulas.', 'encontrado');
        
    } catch (error) {
        console.error('Error accediendo a la cámara:', error);
        mostrarResultado('❌ No se puede acceder a la cámara. Usa el input manual.', 'no-encontrado');
    }
}

// Detener escáner
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

// Buscar cédula (desde input manual)
function buscarCedula() {
    const cedula = document.getElementById('manual-cedula').value.trim();
    if (cedula) {
        buscarCedulaEnDatos(cedula);
        document.getElementById('manual-cedula').value = '';
    }
}

// Buscar cédula en los datos
async function buscarCedulaEnDatos(cedula) {
    console.log('Buscando cédula:', cedula);
    
    if (!datosSheet.length) {
        mostrarResultado('❌ Datos no cargados. Verifica la URL del Sheet.', 'no-encontrado');
        return;
    }
    
    const encontrado = datosSheet.find(persona => 
        persona.cedula === cedula || 
        persona.cedula === cedula.toString()
    );
    
    if (encontrado) {
        // Mostrar resultado inmediatamente
        mostrarResultado(
            `✅ ENCONTRADO<br>
            <strong>${encontrado.nombre}</strong><br>
            Cédula: ${encontrado.cedula}<br>
            Email: ${encontrado.email}<br>
            <small>🎨 Resaltando fila ${encontrado.fila}...</small>`, 
            'encontrado'
        );
        
        // Vibrar si está disponible
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
        
        // Resaltar fila en Google Sheets
        try {
            const resaltado = await resaltarFila(encontrado.fila);
            
            if (resaltado) {
                mostrarResultado(
                    `✅ ENCONTRADO Y RESALTADO<br>
                    <strong>${encontrado.nombre}</strong><br>
                    Cédula: ${encontrado.cedula}<br>
                    Email: ${encontrado.email}<br>
                    <small>🎨 Fila ${encontrado.fila} resaltada en verde oliva</small>`, 
                    'encontrado'
                );
            }
        } catch (error) {
            // Aunque falle el resaltado, ya tenemos el resultado
            console.error('Error resaltando, pero persona encontrada:', error);
        }
        
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
    
    if (tipo === 'encontrado') {
        setTimeout(() => {
            if (resultado.innerHTML === mensaje) {
                resultado.style.display = 'none';
            }
        }, 10000); // 10 segundos para ver el resultado completo
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
    this.style.fontSize = '16px';
});

// Botón para autorizar manualmente si es necesario
function mostrarBotonAutorizar() {
    const container = document.querySelector('.container');
    const botonAuth = document.createElement('button');
    botonAuth.innerHTML = '🔐 Autorizar Google Sheets';
    botonAuth.onclick = authorize;
    botonAuth.style.marginBottom = '20px';
    botonAuth.style.backgroundColor = '#34A853';
    container.insertBefore(botonAuth, document.getElementById('resultado'));
}

// Mostrar botón de autorización al cargar
setTimeout(mostrarBotonAutorizar, 2000);
