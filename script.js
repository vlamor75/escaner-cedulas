// Configuración
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSHSkIJWa2Ac2IhTjzcclUIWEWcdIzX8_2pEOLBQZ8QiIjiautmRYf-QWQpP9LnbAsricEF617yAv6V/pub?gid=0&single=true&output=csv';
const SPREADSHEET_ID = '183ahrrdVdI8nT8dQfR-k1xI0ReqCtaVNZCg3LjP2oSw';
const CLIENT_ID = '126302235387-6akve29ev699n4qu7mmc4vhp3n0phdtb.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDc2QXU57bYL-wKcB0yWMqZObZbNhs1Fn4';
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let datosSheet = [];
let stream = null;
let scanning = false;
let gapi;
let isSignedIn = false;
let gapiLoaded = false;

// Cargar Google API
function loadGoogleAPI() {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = initializeGapi;
    document.head.appendChild(script);
}

// Inicializar Google API
async function initializeGapi() {
    return new Promise((resolve) => {
        gapi.load('auth2:client', async () => {
            try {
                await gapi.client.init({
                    apiKey: API_KEY,
                    clientId: CLIENT_ID,
                    discoveryDocs: [DISCOVERY_DOC],
                    scope: SCOPES
                });
                
                const authInstance = gapi.auth2.getAuthInstance();
                isSignedIn = authInstance.isSignedIn.get();
                gapiLoaded = true;
                
                console.log('Google API inicializada. Signed in:', isSignedIn);
                resolve();
                
            } catch (error) {
                console.error('Error inicializando Google API:', error);
                gapiLoaded = false;
                resolve();
            }
        });
    });
}

// Cargar datos y API al iniciar
document.addEventListener('DOMContentLoaded', async function() {
    // Ocultar configuración
    const configDiv = document.querySelector('.config');
    if (configDiv) {
        configDiv.style.display = 'none';
    }
    
    // Cargar datos CSV
    await cargarDatos();
    
    // Cargar Google API en paralelo
    loadGoogleAPI();
    
    // Configurar eventos
    setupEventListeners();
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

// Autorizar con Google
async function authorize() {
    if (!gapiLoaded) {
        mostrarResultado('⏳ Cargando Google API...', 'encontrado');
        await initializeGapi();
    }
    
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
        mostrarResultado('❌ Error de autorización. Inténtalo de nuevo.', 'no-encontrado');
        return false;
    }
}

// Resaltar fila en Google Sheets
async function resaltarFila(numeroFila) {
    if (!gapiLoaded) {
        console.log('API no cargada, esperando...');
        return false;
    }
    
    if (!isSignedIn) {
        console.log('No autorizado, pidiendo autorización...');
        const authorized = await authorize();
        if (!authorized) return false;
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
        
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { requests }
        });
        
        console.log(`Fila ${numeroFila} resaltada exitosamente`);
        return true;
        
    } catch (error) {
        console.error('Error resaltando fila:', error);
        
        if (error.status === 401 || error.status === 403) {
            console.log('Error de permisos, pidiendo autorización...');
            const authorized = await authorize();
            if (authorized) {
                return await resaltarFila(numeroFila);
            }
        }
        
        return false;
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
        
        // Resaltar en Google Sheets
        setTimeout(async () => {
            const resaltado = await resaltarFila(encontrado.fila);
            
            if (resaltado) {
                mostrarResultado(
                    `✅ ENCONTRADO Y RESALTADO<br>
                    <strong style="font-size: 18px;">${encontrado.nombre}</strong><br>
                    <strong>Cédula:</strong> ${encontrado.cedula}<br>
                    <strong>Email:</strong> ${encontrado.email}<br>
                    <small style="color: green;">🎨 Fila ${encontrado.fila} resaltada en verde oliva</small>`, 
                    'encontrado'
                );
            } else {
                mostrarResultado(
                    `✅ ENCONTRADO<br>
                    <strong style="font-size: 18px;">${encontrado.nombre}</strong><br>
                    <strong>Cédula:</strong> ${encontrado.cedula}<br>
                    <strong>Email:</strong> ${encontrado.email}<br>
                    <small style="color: orange;">⚠️ No se pudo resaltar. <button onclick="authorize()" style="font-size:12px;">Autorizar Google</button></small>`, 
                    'encontrado'
                );
            }
        }, 500);
        
    } else {
        mostrarResultado(`❌ CÉDULA NO EXISTE<br><small>No encontrado: ${cedula}</small>`, 'no-encontrado');
        
        if (navigator.vibrate) {
            navigator.vibrate([500]);
        }
    }
}

// Funciones de cámara (mantenidas pero simplificadas)
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

// Función dummy para compatibilidad
function guardarURL() {
    mostrarResultado('ℹ️ URL ya configurada', 'encontrado');
    setTimeout(() => {
        document.getElementById('resultado').style.display = 'none';
    }, 2000);
}
