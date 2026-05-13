import { Before, After } from '@cucumber/cucumber';
import { MyWorld } from './world';

Before(async function (this: MyWorld) {
    await this.initNest();
    await this.cleanDb();
});

After(async function (this: MyWorld, scenario: { result?: { status?: string } }) {
    if (scenario.result?.status === 'FAILED') {
        const responses = [
            this.world.create_vehicle_response,
            this.world.update_vehicle_response,
            this.world.delete_vehicle_response,
            this.world.enable_vehicle_response,
        ].filter(Boolean);
        if (responses.length > 0) {
            this.attach(JSON.stringify(responses, null, 2), 'application/json');
        }
    }
    if (this.app) {
        await this.app.close();
    }
});
