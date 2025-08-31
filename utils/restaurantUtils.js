function isRestaurantOpen(restaurant) {
    if (!restaurant.activo) {
        return false;
    }
    try {
        let diasOperacion;
        if (Array.isArray(restaurant.dias_operacion)) {
            diasOperacion = restaurant.dias_operacion;
        } else if (typeof restaurant.dias_operacion === 'string') {
            try {
                diasOperacion = JSON.parse(restaurant.dias_operacion);
                if (!Array.isArray(diasOperacion)) {
                    diasOperacion = [];
                }
            } catch (e) {
                console.error('Error parsing dias_operacion JSON:', e);
                diasOperacion = [];
            }
        } else {
            diasOperacion = [];
        }

        // Ensure all elements in diasOperacion are numbers
        diasOperacion = diasOperacion.map(Number).filter(dia => !isNaN(dia));

        // Obtener hora local de Argentina (GMT-3)
        const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
        const diaSemana = ahora.getDay(); // 0 (Domingo) a 6 (Sábado)
        const horaActual = ahora.getHours() + (ahora.getMinutes() / 60);

        // Mapeo de getDay() a ISO 8601 (1 Lunes - 7 Domingo)
        const diaSemanaISO = (diaSemana === 0) ? 7 : diaSemana;

        if (!diasOperacion.includes(diaSemanaISO)) {
            return false; // Cerrado hoy
        }

        if (!restaurant.horario_apertura || !restaurant.horario_cierre) {
            return false;
        }
        const [aperturaH, aperturaM] = (restaurant.horario_apertura || '00:00').split(':').map(Number);
        const [cierreH, cierreM] = (restaurant.horario_cierre || '00:00').split(':').map(Number);
        const horaApertura = aperturaH + (aperturaM / 60);
        let horaCierre = cierreH + (cierreM / 60);

        // Caso 1: Horario nocturno que cruza la medianoche (ej. 20:00 - 02:00)
        if (horaCierre < horaApertura) {
            if (horaActual >= horaApertura || horaActual < horaCierre) {
                return true;
            }
        }
        // Caso 2: Horario normal en el mismo día (ej. 09:00 - 17:00)
        else {
            if (horaActual >= horaApertura && horaActual < horaCierre) {
                return true;
            }
        }

        return false; // Si no se cumplió ninguna condición, está cerrado

    } catch (error) {
        console.error('Error general al verificar si el restaurante está abierto:', error);
        return false; // Por seguridad, si hay error, se marca como cerrado
    }
}

function processRestaurantList(restaurants) {
    if (!Array.isArray(restaurants)) return [];
    return restaurants.map(r => ({
        ...r,
        abierto: isRestaurantOpen(r)
    }));
}

module.exports = { isRestaurantOpen, processRestaurantList };