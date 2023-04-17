
import chai from 'chai';
import chaiHttp from 'chai-http';
import { AppService } from '../src/service/appService';
import { ExpressApp } from '../src/index';



chai.use(chaiHttp);
const expect = chai.expect;




describe('test', async () => {

    const expressApp = new ExpressApp();
    const app = expressApp.app;
    const appService = (expressApp.appService) as AppService;

    before(async () => {
        await expressApp.start();
    })
    after(async () => {
        await expressApp.stop();
    })
    beforeEach(async () => {
        await appService.redisService.flushAll();
    })

    it('GET /test', async () => {

        let response: any = await new Promise((resolve: any, reject: any) => {
            chai.request(app)
                .get('/test')
                .end((err, res) => {
                    if (err)
                        reject(err);
                    else
                        resolve(res);

                });

        })

        expect(response.status).to.equal(200);

    }).timeout(5000);

})


