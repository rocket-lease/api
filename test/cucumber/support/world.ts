import { IWorldOptions, setWorldConstructor, World } from "@cucumber/cucumber";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "@/app.module";

export interface MyWorld extends World {
    app: INestApplication;
    response: any;
    initNest(): Promise<void>;
};

class CustomWorld extends World implements MyWorld {
    app: INestApplication;
    response: any;
    
    constructor(options: IWorldOptions) {
        super(options)
    }

    async initNest() {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        this.app = moduleFixture.createNestApplication();
        await this.app.init();
    }
}

setWorldConstructor(CustomWorld);
