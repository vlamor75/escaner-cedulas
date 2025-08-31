// Configuración de Google Sheets API
const CLIENT_ID = '126302235387-6akve29ev699n4qu7mmc4vhp3n0phdtb.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDc2QXU57bYL-wKcB0yWMqZObZbNhs1Fn4'; // Lo configuraremos después
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let stream = null;
let datosSheet = [];
let scanning = false;
let gapi;
let isSignedIn = false;
let currentSpreadsheetId = '';

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
    
    const savedUrl = localStorage.getItem('sheetUrl');
    if (savedUrl) {
        document.getElementById('sheet-url').value = savedUrl;
        cargarDatosSheet(savedUrl);
    }
});

// Extraer ID del spreadsheet de la URL
function extractSpreadsheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}

// Autorizar con Google
async function authorize() {
    try {
        const authInstance = gapi.auth2.getAuthInstance();
        await authInstance.signIn();
        isSignedIn = true;
        mostrarResultado('✅ Autorizado con Google', 'encontrado');
        return true;
    } catch (error) {
        console.error('Error de autorización:', error);
        mostrarResultado('❌ Error de autorización', 'no-encontrado');
        return false;
    }
}

// Guardar URL del Google Sheet
function guardarURL() {
    const url = document.getElementById('sheet-url').value;
    if (url) {
        currentSpreadsheetId = extractSpreadsheetId(url);
        if (!currentSpreadsheetId) {
            mostrarResultado('❌ URL inválida. Usa una URL de Google Sheets', 'no-encontrado');
            return;
        }
        
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
                fila: index + 1, // Número de fila para resaltar
                cedula: cols[0]?.trim().replace(/"/g, ''),
                nombre: cols[1]?.trim().replace(/"/g, ''),
                email: cols[2]?.trim().replace(/"/g, '')
            };
        }).filter(row => row.cedula); // Filtrar filas vacías
        
        console.log('Datos cargados:', datosSheet.length, 'registros');
    } catch (error) {
        console.error('Error cargando datos:', error);
        mostrarResultado('❌ Error cargando datos del Sheet', 'no-encontrado');
    }
}

// Resaltar fila en Google Sheets
async function resaltarFila(numeroFila) {
    if (!isSignedIn) {
        const authorized = await authorize();
        if (!authorized) return false;
    }
    
    if (!currentSpreadsheetId) {
        mostrarResultado('❌ No se puede resaltar: falta ID del spreadsheet', 'no-encontrado');
        return false;
    }
    
    try {
        const requests = [{
            updateCells: {
                range: {
                    sheetId: 0,
                    startRowIndex: numeroFila - 1,
                    endRowIndex: numeroFila,
                    startColumnIndex: 0,
                    endColumnIndex: 10
                },
                rows: [{
                    values: Array(10).fill({
                        userEnteredFormat: {
                            backgroundColor: {
                                red: 0.5,
                                green: 0.7,
                                blue: 0.2,
                                alpha: 1.0
                            }
                        }
                    })
                }],
                fields: 'userEnteredFormat.backgroundColor'
            }
        }];
        
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: currentSpreadsheetId,
            requestBody: { requests }
        });
        
        return true;
    } catch (error) {
        console.error('Error resaltando fila:', error);
        mostrarResultado('❌ Error resaltando en Google Sheets', 'no-encontrado');
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
        // Mostrar resultado
        mostrarResultado(
            `✅ ENCONTRADO<br>
            <strong>${encontrado.nombre}</strong><br>
            Cédula: ${encontrado.cedula}<br>
            Email: ${encontrado.email}<br>
            <small>Resaltando fila ${encontrado.fila}...</small>`, 
            'encontrado'
        );
        
        // Resaltar fila en Google Sheets
        const resaltado = await resaltarFila(encontrado.fila);
        if (resaltado) {
            setTimeout(() => {
                mostrarResultado(
                    `✅ ENCONTRADO Y RESALTADO<br>
                    <strong>${encontrado.nombre}</strong><br>
                    Cédula: ${encontrado.cedula}<br>
                    Email: ${encontrado.email}`, 
                    'encontrado'
                );
            }, 1000);
        }
        
        // Vibrar si está disponible
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
        }, 8000); // Más tiempo para ver el resultado
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
