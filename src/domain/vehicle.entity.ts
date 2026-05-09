export class Vehicle{
    constructor(private readonly plate: string) {
        if (!plate || plate.trim() === '') {
            //TODO: Cambiar a DomainError
            throw new Error("Cannot create a vehicle with an empty plate");
        }
    }

    getPlate(): string {
        return this.plate;
    }
};
