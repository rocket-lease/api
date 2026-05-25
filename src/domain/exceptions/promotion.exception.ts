import { DomainException } from "./domain.exception";

export class VehicleAlreadyPromoted extends DomainException {
  constructor() {
    super('Vehicle is already promoted');
  }
}
