export class Vehicle {
  constructor(
    private readonly plate: string,
    private readonly brand: string,
    private readonly model: string,
    private color: string,
    private mileage: number,
    private basePrice: number,
    private description: string,
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.plate?.trim()) {
      throw new Error("Cannot create a vehicle with an empty plate");
    }
    
    if (this.mileage < 0) {
      throw new Error("Mileage cannot be negative");
    }

    if (this.basePrice <= 0) {
      throw new Error("Base price must be greater than zero");
    }
  }

  public getPlate(): string {
    return this.plate;
  }

}
