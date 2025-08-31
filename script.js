// Configuración
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwA0MinrCYcwyviNNWwFSh9x0L-TRKXWntQJQXx6eGRxXyisq_NBvE2GDp8sGbDDWobDQ/exec';

let timeoutId = null;
let consecutiveSearches = 0;
let lastScanTime = 0;

document.addEventListener('DOMContentLoaded', function() {
    console.log('App optimizada para pistola de códigos de barras + input manual');
    
    // Ocultar configuración y cámara
    const configDiv = document.querySelector('.config');
    const scannerDiv = document.getElementById('scanner-container');
    const buttonsDiv = document.querySelector('.buttons');
    
    if (configDiv) configDiv.style.display = 'none';
    if (scannerDiv) scannerDiv.style.display = 'none';
    if (buttonsDiv) buttonsDiv.style.display = 'none';
    
    setupOptimizedInput();
    setupBarcodeGunSupport();
    
    mostrarResultado('🔫 Sistema listo para pistola de códigos + input manual', 'encontrado');
    setTimeout(() => {
        document.getElementById('resultado').style.display = 'none';
    }, 4000);
});

function setupOptimizedInput() {
    const input = document.getElementById('manual-cedula');
    
    // Hacer el input más grande y visible
    input.style.fontSize = '24px';
    input.style.padding = '15px';
    input.style.textAlign = 'center';
    input.style.fontWeight = 'bold';
    input.style.border = '3px solid #28a745';
    input.style.borderRadius = '10px';
    input.style.marginBottom = '10px';
    input.style.backgroundColor = '#f8fff8';
    
    // Placeholder específico para pistola
    input.placeholder = '🔫 Escanea con pistola o escribe aquí';
    
    // Buscar automáticamente con Enter
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            buscarCedula();
        }
    });
    
    // Procesar entrada de pistola mientras escribe
    input.addEventListener('input', function(e) {
        const value = this.value;
        
        // Detectar si viene de pistola (datos largos o con separadores)
        if (value.length > 15 || value.includes('|') || value.includes('||') || /[A-Z]{2,}/.test(value)) {
            // Es datos de pistola, procesarlos inmediatamente
            setTimeout(() => {
                procesarDatosPistola(value);
            }, 100);
        } else {
            // Es input manual normal, solo formatear
            let cleanValue = value.replace(/[^0-9]/g, '');
            
            // Formatear con puntos si es necesario
            if (cleanValue.length > 3) {
                cleanValue = cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            }
            
            this.value = cleanValue;
            
            // Mostrar hint si tiene suficientes dígitos
            const soloNumeros = cleanValue.replace(/\D/g, '');
            if (soloNumeros.length >= 8) {
                mostrarResultado('✅ Cédula lista - presiona Enter para buscar', 'encontrado');
            }
        }
    });
    
    // Auto-focus y seleccionar todo
    input.addEventListener('focus', function() {
        this.select();
    });
    
    // Focus automático
    setTimeout(() => {
        input.focus();
    }, 500);
}

function setupBarcodeGunSupport() {
    const input = document.getElementById('manual-cedula');
    
    // Detectar entrada rápida de pistola (muchos caracteres en poco tiempo)
    let inputBuffer = '';
    let inputTimer = null;
    
    input.addEventListener('input', function() {
        const currentTime = Date.now();
        
        // Si la entrada es muy rápida (menos de 50ms entre caracteres), probablemente es pistola
        if (currentTime - lastScanTime < 50 && this.value.length > inputBuffer.length + 1) {
            clearTimeout(inputTimer);
            inputTimer = setTimeout(() => {
                // Procesar como datos de pistola
                procesarDatosPistola(this.value);
            }, 200); // Esperar 200ms después del último carácter
        }
        
        lastScanTime = currentTime;
        inputBuffer = this.value;
    });
}

function procesarDatosPistola(datosCrudos) {
    console.log('Datos crudos de pistola:', datosCrudos);
    
    // Extraer número de cédula de diferentes formatos posibles
    let cedula = extraerCedulaDeDatos(datosCrudos);
    
    if (cedula) {
        const input = document.getElementById('manual-cedula');
        input.value = cedula;
        
        mostrarResultado(`🔫 Pistola detectada - Cédula: ${cedula}`, 'encontrado');
        
        // Buscar automáticamente después de 1 segundo
        setTimeout(() => {
            buscarYResaltarEnSheet(cedula);
        }, 1000);
    } else {
        mostrarResultado('⚠️ No se pudo extraer cédula de los datos escaneados', 'no-encontrado');
        console.log('Datos no procesables:', datosCrudos);
    }
}

function extraerCedulaDeDatos(datos) {
    console.log('Extrayendo cédula de:', datos);
    
    // Limpiar datos
    let datoLimpio = datos.trim();
    
    // Formato 1: Solo número de cédula (98624968)
    if (/^\d{6,12}$/.test(datoLimpio)) {
        return datoLimpio;
    }
    
    // Formato 2: Datos separados por pipe (98624968|VLADIMIR|MORENO|...)
    if (datoLimpio.includes('|')) {
        const partes = datoLimpio.split('|');
        // Buscar la primera parte que sea solo números y tenga entre 6-12 dígitos
        for (let parte of partes) {
            const numero = parte.trim().replace(/\D/g, '');
            if (numero.length >= 6 && numero.length <= 12) {
                return numero;
            }
        }
    }
    
    // Formato 3: Datos con separadores especiales o espacios
    const separadores = ['||', '  ', '\t', '\n', ';', ','];
    for (let sep of separadores) {
        if (datoLimpio.includes(sep)) {
            const partes = datoLimpio.split(sep);
            for (let parte of partes) {
                const numero = parte.trim().replace(/\D/g, '');
                if (numero.length >= 6 && numero.length <= 12) {
                    return numero;
                }
            }
        }
    }
    
    // Formato 4: Buscar patrón de cédula en texto mixto
    const patronesCedula = [
        /\b(\d{8,12})\b/,  // 8-12 dígitos aislados
        /(\d{1,3}\.?\d{3}\.?\d{3,4})/,  // Formato con puntos opcionales
        /ID:?(\d{6,12})/i,  // Precedido por ID
        /CC:?(\d{6,12})/i   // Precedido por CC (Cédula de Ciudadanía)
    ];
    
    for (let patron of patronesCedula) {
        const match = datoLimpio.match(patron);
        if (match) {
            const numero = match[1].replace(/\D/g, '');
            if (numero.length >= 6 && numero.length <= 12) {
                return numero;
            }
        }
    }
    
    // Formato 5: Extraer solo el primer número largo encontrado
    const numerosEncontrados = datoLimpio.match(/\d{6,12}/g);
    if (numerosEncontrados && numerosEncontrados.length > 0) {
        return numerosEncontrados[0];
    }
    
    // Si todo falla, intentar extraer cualquier secuencia de números
    const todosNumeros = datoLimpio.replace(/\D/g, '');
    if (todosNumeros.length >= 6 && todosNumeros.length <= 12) {
        return todosNumeros;
    }
    
    return null;
}

function buscarYResaltarEnSheet(cedula) {
    // Limpiar formato (quitar puntos)
    const cedulaLimpia = cedula.toString().replace(/\D/g, '');
    
    console.log('Buscando cédula:', cedulaLimpia);
    
    if (timeoutId) {
        clearTimeout(timeoutId);
    }
    
    consecutiveSearches++;
    
    mostrarResultado(
        `🔄 Buscando cédula ${cedulaLimpia}...<br>
        <small>Búsqueda #${consecutiveSearches} ${consecutiveSearches > 1 ? '🔫' : ''}</small>`, 
        'encontrado'
    );
    
    const url = `${APPS_SCRIPT_URL}?cedula=${encodeURIComponent(cedulaLimpia)}`;
    
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    
    document.body.appendChild(iframe);
    
    timeoutId = setTimeout(() => {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
        
        const iconoBusqueda = consecutiveSearches % 3 === 0 ? '🎯' : '🔫';
        
        mostrarResultado(
            `✅ BÚSQUEDA #${consecutiveSearches} COMPLETADA ${iconoBusqueda}<br>
            <strong style="font-size: 20px;">Cédula: ${cedulaLimpia}</strong><br>
            <div style="margin-top: 10px; padding: 10px; background: #e8f5e8; border-radius: 8px;">
                🎨 <strong>Si existe, está resaltada en verde oliva</strong><br>
                📋 Verifica tu Google Sheet<br>
                ⚡ Lista para la siguiente búsqueda
            </div>`, 
            'encontrado'
        );
        
        // Vibración progresiva
        if (navigator.vibrate) {
            if (consecutiveSearches % 10 === 0) {
                // Vibración especial cada 10
                navigator.vibrate([200, 100, 200, 100, 200, 100, 400]);
            } else if (consecutiveSearches % 5 === 0) {
                // Vibración cada 5
                navigator.vibrate([200, 100, 200, 100, 400]);
            } else {
                navigator.vibrate([200, 100, 200]);
            }
        }
        
        // Auto-focus para siguiente búsqueda
        setTimeout(() => {
            const input = document.getElementById('manual-cedula');
            input.value = ''; // Limpiar para siguiente
            input.focus();
            input.select();
        }, 2000);
        
    }, 2500);
}

function buscarCedula() {
    const input = document.getElementById('manual-cedula');
    const cedula = input.value.trim();
    
    // Si contiene datos complejos, procesar como pistola
    if (cedula.length > 15 || cedula.includes('|') || /[A-Z]{2,}/.test(cedula)) {
        procesarDatosPistola(cedula);
        return;
    }
    
    // Extraer solo números
    const soloNumeros = cedula.replace(/\D/g, '');
    
    if (soloNumeros.length >= 4) {
        buscarYResaltarEnSheet(soloNumeros);
    } else {
        mostrarResultado('⚠️ Ingresa al menos 4 dígitos de la cédula', 'no-encontrado');
        setTimeout(() => {
            document.getElementById('resultado').style.display = 'none';
            input.focus();
        }, 2000);
    }
}

function mostrarResultado(mensaje, tipo) {
    const resultado = document.getElementById('resultado');
    if (resultado) {
        resultado.innerHTML = mensaje;
        resultado.className = tipo;
        resultado.style.display = 'block';
    }
}

// Funciones dummy para compatibilidad
function iniciarEscaner() {
    mostrarResultado('🔫 La pistola de códigos es más eficiente que la cámara 😊', 'encontrado');
    setTimeout(() => {
        document.getElementById('manual-cedula').focus();
        document.getElementById('resultado').style.display = 'none';
    }, 3000);
}

function detenerEscaner() {
    document.getElementById('manual-cedula').focus();
}

function guardarURL() {
    mostrarResultado(
        `📊 Estadísticas:<br>
        ✅ ${consecutiveSearches} búsquedas realizadas<br>
        🔫 Sistema optimizado para pistola de códigos<br>
        ⚡ Compatible con input manual`, 
        'encontrado'
    );
    setTimeout(() => {
        document.getElementById('resultado').style.display = 'none';
    }, 4000);
}

// Atajos de teclado útiles
document.addEventListener('keydown', function(e) {
    // F2 para focus rápido
    if (e.key === 'F2') {
        e.preventDefault();
        document.getElementById('manual-cedula').focus();
    }
    
    // Escape para limpiar
    if (e.key === 'Escape') {
        const input = document.getElementById('manual-cedula');
        input.value = '';
        input.focus();
        document.getElementById('resultado').style.display = 'none';
    }
    
    // F5 para estadísticas rápidas
    if (e.key === 'F5') {
        e.preventDefault();
        guardarURL();
    }
});

console.log('App cargada - Compatible con pistola de códigos de barras + input manual');
