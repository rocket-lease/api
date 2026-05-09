import { Before, After } from '@cucumber/cucumber';
import { MyWorld } from './world';

Before(async function (this: MyWorld) {
    await this.initNest();
});

After(async function (this: MyWorld) {
    if (this.app) {
        await this.app.close();
    }
});
