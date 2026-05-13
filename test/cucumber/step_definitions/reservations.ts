import { Given, Then } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import { DataTable } from '@cucumber/cucumber';

Given(
  'el vehículo tiene las siguientes reservas:',
  function (this: MyWorld, _dataTable: DataTable) {
    // Ignorado: implementación pendiente (escenarios @ignore)
    return 'pending';
  },
);

Then('el sistema cancela las reservas', function (this: MyWorld) {
  // Ignorado: implementación pendiente (escenarios @ignore)
  return 'pending';
});

Then('no afecta reservas ya confirmadas', function (this: MyWorld) {
  // Ignorado: implementación pendiente (escenarios @ignore)
  return 'pending';
});
