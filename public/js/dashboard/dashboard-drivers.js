document.addEventListener('DOMContentLoaded', function() {
    const addDriverForm = document.getElementById('addDriverForm');
    const editDriverForm = document.getElementById('editDriverForm');
    const driversTableBody = document.querySelector('#driversTable tbody');

    // Handle Add Driver Form Submission
    if (addDriverForm) {
        addDriverForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const formData = new FormData(addDriverForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/dashboard/drivers/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                const result = await response.json();

                if (result.success) {
                    alert(result.message);
                    window.location.reload();
                } else {
                    alert('Error: ' + result.message + (result.errors ? '\n' + result.errors.join('\n') : ''));
                }
            } catch (error) {
                console.error('Error adding driver:', error);
                alert('Error al añadir repartidor.');
            }
        });
    }

    // Populate Edit Driver Modal
    document.querySelectorAll('.edit-driver-btn').forEach(button => {
        button.addEventListener('click', function() {
            const id = this.dataset.id;
            const nombre = this.dataset.nombre;
            const apellido = this.dataset.apellido;
            const email = this.dataset.email;
            const telefono = this.dataset.telefono;
            const vehicle = this.dataset.vehicle;
            const status = this.dataset.status;

            document.getElementById('editDriverId').value = id;
            document.getElementById('editDriverNombre').value = nombre;
            document.getElementById('editDriverApellido').value = apellido;
            document.getElementById('editDriverEmail').value = email;
            document.getElementById('editDriverTelefono').value = telefono;
            document.getElementById('editDriverVehicleType').value = vehicle;
            document.getElementById('editDriverStatus').value = status;
        });
    });

    // Handle Edit Driver Form Submission
    if (editDriverForm) {
        editDriverForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const driverId = document.getElementById('editDriverId').value;
            const formData = new FormData(editDriverForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch(`/dashboard/drivers/${driverId}/edit`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                const result = await response.json();

                if (result.success) {
                    alert(result.message);
                    window.location.reload();
                } else {
                    alert('Error: ' + result.message + (result.errors ? '\n' + result.errors.join('\n') : ''));
                }
            } catch (error) {
                console.error('Error updating driver:', error);
                alert('Error al actualizar repartidor.');
            }
        });
    }

    // Handle Delete Driver Button
    document.querySelectorAll('.delete-driver-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const driverId = this.dataset.id;
            if (confirm('¿Estás seguro de que quieres eliminar este repartidor?')) {
                try {
                    const response = await fetch(`/dashboard/drivers/${driverId}/delete`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    const result = await response.json();

                    if (result.success) {
                        alert(result.message);
                        window.location.reload();
                    } else {
                        alert('Error: ' + result.message);
                    }
                } catch (error) {
                    console.error('Error deleting driver:', error);
                    alert('Error al eliminar repartidor.');
                }
            }
        });
    });
});