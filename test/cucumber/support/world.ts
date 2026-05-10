import { IWorldOptions, setWorldConstructor, World } from "@cucumber/cucumber";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "@/app.module";
import { DomainExceptionFilter } from "@/infraestructure/filters/domain-exception.filter";

interface GlobalContext {
    create_vehicle_dto?: any;
    create_vehicle_response?: any;
    last_user_id?: string;
    response?: any;
}

export interface MyWorld extends World {
    app: INestApplication;
    world: GlobalContext;
    initNest(): Promise<void>;
};

class CustomWorld extends World implements MyWorld {
    app: INestApplication;
    world: any;
    
    constructor(options: IWorldOptions) {
        super(options);
        this.world = {};
    }

    async initNest() {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        this.app = moduleFixture.createNestApplication();
        this.app.useGlobalFilters(new DomainExceptionFilter());
        await this.app.init();
    }
}

setWorldConstructor(CustomWorld);
