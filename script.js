// Configuración
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSHSkIJWa2Ac2IhTjzcclUIWEWcdIzX8_2pEOLBQZ8QiIjiautmRYf-QWQpP9LnbAsricEF617yAv6V/pub?gid=0&single=true&output=csv';
const SPREADSHEET_ID = '183ahrrdVdI8nT8dQfR-k1xI0ReqCtaVNZCg3LjP2oSw';
const CLIENT_ID = '126302235387-6akve29ev699n4qu7mmc4vhp3n0phdtb.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let datosSheet = [];
let stream = null;
let scanning = false;
let accessToken = null;
let tokenClient = null;
let gapiInited = false;
let gisInited = false;

// Cargar Google APIs (nueva versión)
function loadGoogleAPIs() {
    // Cargar Google API Client
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.onload = gapiLoaded;
    gapiScript.onerror = () => {
        console.error('Error cargando GAPI');
        mostrarEstadoAPI('❌ Error cargando Google API');
    };
    document.head.appendChild(gapiScript);

    // Cargar Google Identity Services
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = gisLoaded;
    gisScript.onerror = () => {
        console.error('Error cargando GIS');
        mostrarEstadoAPI('❌ Error cargando Google Identity');
    };
    document.head.appendChild(gisScript);
}

// GAPI cargado
async function gapiLoaded() {
    await gapi.load('client', initializeGapiClient);
}

// Inicializar cliente GAPI
async function initializeGapiClient() {
    try {
        await gapi.client.init({
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
        });
        gapiInited = true;
        console.log('GAPI inicializado');
        checkAPIsReady();
    } catch (error) {
        console.error('Error inicializando GAPI:', error);
        mostrarEstadoAPI('❌ Error inicializando Google API');
    }
}

// GIS cargado
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
            if (response.error !== undefined) {
                console.error('Error de autenticación:', response);
                mostrarResultado('❌ Error de autenticación', 'no-encontrado');
                return;
            }
            accessToken = response.access_token;
            console.log('Token obtenido exitosamente');
            mostrarResultado('✅ Autorizado con Google', 'encontrado');
        },
    });
    gisInited = true;
    console.log('GIS inicializado');
    checkAPIsReady();
}

// Verificar si las APIs están listas
function checkAPIsReady() {
    if (gapiInited && gisInited) {
        console.log('Todas las APIs están listas');
        mostrarEstadoAPI('✅ Google APIs listas');
    }
}

// Mostrar estado de la API
function mostrarEstadoAPI(mensaje) {
    console.log(mensaje);
    // Solo mostrar en consola para no saturar la interfaz
}

// Solicitar autorización
function authorize() {
    if (!gisInited) {
        mostrarResultado('⏳ Preparando autorización...', 'encontrado');
        return;
    }
    
    if (accessToken) {
        console.log('Ya tienes token válido');
        mostrarResultado('✅ Ya estás autorizado', 'encontrado');
        return;
    }

    mostrarResultado('🔐 Solicitando permisos de Google...', 'encontrado');
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

// Revocar autorización
function revokeAuthorization() {
    if (accessToken) {
        google.accounts.oauth2.revoke(accessToken);
        accessToken = null;
        mostrarResultado('🚪 Autorización revocada', 'no-encontrado');
    }
}

// Resaltar fila en Google Sheets
async function resaltarFila(numeroFila) {
    if (!gapiInited) {
        console.log('GAPI no inicializado');
        return false;
    }
    
    if (!accessToken) {
        console.log('Sin token de acceso, solicitando autorización...');
        authorize();
        return false;
    }

    try {
        console.log(`Resaltando fila ${numeroFila}...`);
        
        // Configurar token de acceso
        gapi.client.setToken({ access_token: accessToken });
        
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
                                red: 0.5,   // Verde oliva
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
        
        const response = await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { requests }
        });
        
        console.log(`Fila ${numeroFila} resaltada exitosamente`);
        return true;
        
    } catch (error) {
        console.error('Error resaltando fila:', error);
        
        if (error.status === 401) {
            console.log('Token expirado, solicitando nuevo...');
            accessToken = null;
            authorize();
            return false;
        }
        
        mostrarResultado('❌ Error resaltando en Google Sheets', 'no-encontrado');
        return false;
    }
}

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM cargado, iniciando app...');
    
    // Ocultar configuración
    const configDiv = document.querySelector('.config');
    if (configDiv) {
        configDiv.style.display = 'none';
    }
    
    // Cargar datos CSV
    await cargarDatos();
    
    // Configurar eventos
    setupEventListeners();
    
    // Cargar Google APIs
    loadGoogleAPIs();
});

// Configurar event listeners
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
}

// Cargar datos del CSV
async function cargarDatos() {
    try {
        mostrarResultado('🔄 Cargando datos...', 'encontrado');
        
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
        mostrarResultado(`✅ ${datosSheet.length} registros cargados`, 'encontrado');
        
        setTimeout(() => {
            const resultado = document.getElementById('resultado');
            if (resultado && resultado.innerHTML.includes('registros cargados')) {
                resultado.style.display = 'none';
            }
        }, 3000);
        
    } catch (error) {
        console.error('Error cargando datos:', error);
        mostrarResultado('❌ Error cargando datos', 'no-encontrado');
    }
}

// Buscar cédula
function buscarCedula() {
    const input = document.getElementById('manual-cedula');
    const cedula = input.value.trim();
    
    if (cedula) {
        buscarCedulaEnDatos(cedula);
        input.value = '';
        input.focus();
    }
}

// Buscar en datos y resaltar
async function buscarCedulaEnDatos(cedula) {
    console.log('Buscando cédula:', cedula);
    
    if (!datosSheet.length) {
        mostrarResultado('❌ Datos no cargados aún', 'no-encontrado');
        return;
    }
    
    const encontrado = datosSheet.find(persona => 
        persona.cedula === cedula || 
        persona.cedula === cedula.toString()
    );
    
    if (encontrado) {
        // Mostrar encontrado inmediatamente
        mostrarResultado(
            `✅ ENCONTRADO<br>
            <strong style="font-size: 18px;">${encontrado.nombre}</strong><br>
            <strong>Cédula:</strong> ${encontrado.cedula}<br>
            <strong>Email:</strong> ${encontrado.email}<br>
            <small>🎨 Resaltando fila ${encontrado.fila}...</small>`, 
            'encontrado'
        );
        
        // Vibrar
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
        
        // Intentar resaltar después de un momento
        setTimeout(async () => {
            const resaltado = await resaltarFila(encontrado.fila);
            
            if (resaltado) {
                mostrarResultado(
                    `✅ ENCONTRADO Y RESALTADO<br>
                    <strong style="font-size: 18px;">${encontrado.nombre}</strong><br>
                    <strong>Cédula:</strong> ${encontrado.cedula}<br>
                    <strong>Email:</strong> ${encontrado.email}<br>
                    <small style="color: green;">🎨 Fila ${encontrado.fila} resaltada en verde oliva ✓</small>`, 
                    'encontrado'
                );
            } else {
                const estadoAuth = accessToken ? 'Reintentando...' : 'Necesitas autorización';
                const botonAuth = !accessToken ? 
                    `<button onclick="authorize()" style="font-size:12px; padding:4px 12px; background:#4285f4; color:white; border:none; border-radius:4px; cursor:pointer; margin-left:10px;">Autorizar Google</button>` : 
                    '';
                    
                mostrarResultado(
                    `✅ ENCONTRADO<br>
                    <strong style="font-size: 18px;">${encontrado.nombre}</strong><br>
                    <strong>Cédula:</strong> ${encontrado.cedula}<br>
                    <strong>Email:</strong> ${encontrado.email}<br>
                    <small style="color: orange;">⚠️ ${estadoAuth}${botonAuth}</small>`, 
                    'encontrado'
                );
            }
        }, 1000);
        
    } else {
        mostrarResultado(`❌ CÉDULA NO EXISTE<br><small>No encontrado: ${cedula}</small>`, 'no-encontrado');
        
        if (navigator.vibrate) {
            navigator.vibrate([500]);
        }
    }
}

// Funciones de cámara (mantenidas)
async function iniciarEscaner() {
    try {
        if (!datosSheet.length) {
            mostrarResultado('❌ Esperando datos...', 'no-encontrado');
            return;
        }

        const video = document.getElementById('video');
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        
        video.srcObject = stream;
        video.play();
        
        document.getElementById('start-scan').style.display = 'none';
        document.getElementById('stop-scan').style.display = 'inline-block';
        
        scanning = true;
        mostrarResultado('📷 Cámara activa. Usa el campo manual.', 'encontrado');
        
    } catch (error) {
        mostrarResultado('❌ Error con cámara. Usa input manual.', 'no-encontrado');
    }
}

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
}

// Mostrar resultado
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

// Función para compatibilidad
function guardarURL() {
    mostrarResultado('ℹ️ URL ya configurada', 'encontrado');
    setTimeout(() => {
        document.getElementById('resultado').style.display = 'none';
    }, 2000);
}

// Funciones globales para debug
window.authorize = authorize;
window.revokeAuthorization = revokeAuthorization;
